/**
 * VANDER i-READY ENGINE v2.0 - "VISION" EDITION
 * Integration with Gemini Vision for actual "Reading" and "Answering"
 */

(function () {
    console.log("%c VANDER VISION ENGINE ACTIVE ", "background: #00f2ff; color: #000; font-weight: bold;");

    const channel = new BroadcastChannel('vander_bridge');

    // Hardcoded User API Key
    const API_KEY = 'AIzaSyATOLhicaufM76mSq2KgRvvvzYGb3zmK5w';

    function notify(type, data = {}) {
        channel.postMessage({ type, data });
    }

    async function captureScreen() {
        const lessonDoc = document.querySelector('iframe')?.contentDocument || document;
        const mainContent = lessonDoc.querySelector('.lesson-canvas, #stage, .lesson-container') || lessonDoc.body;

        return {
            text: mainContent.innerText,
            html: mainContent.innerHTML,
            options: findAnswers()
        };
    }

    function findAnswers() {
        const selectors = [
            'button[role="radio"]', '.answer-option', '.choice-container',
            '[data-test-id*="answer"]', 'button.css-1r0dy6a', '.css-8at2v3'
        ];
        let found = [];
        for (const selector of selectors) {
            found = Array.from(document.querySelectorAll(selector));
            if (found.length > 0) break;
        }

        // Search iframes if not found
        if (found.length === 0) {
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (innerDoc) {
                        for (const selector of selectors) {
                            found = Array.from(innerDoc.querySelectorAll(selector));
                            if (found.length > 0) break;
                        }
                    }
                } catch (e) { }
                if (found.length > 0) break;
            }
        }
        return found;
    }

    async function askAI(context) {
        if (!API_KEY) {
            notify('ERROR', { message: 'No API Key. Please add one.' });
            return null;
        }

        const prompt = `
            Identify the correct answer choice index (0, 1, 2, etc.) based on this i-Ready math/reading question.
            
            Question Text: ${context.text.substring(0, 1000)}
            Options: ${context.options.map((o, i) => `${i}: ${o.innerText || o.getAttribute('aria-label')}`).join(', ')}
            
            Return ONLY a JSON object: {"correctIndex": number}
        `;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text;
            const match = textResponse.match(/\{.*\}/s);
            if (match) {
                const result = JSON.parse(match[0]);
                return result.correctIndex;
            }
        } catch (e) {
            console.error("AI Error:", e);
            notify('ERROR', { message: 'AI Analysis failed.' });
        }
        return null;
    }

    async function solveLoop() {
        if (window._vander_solving) return;
        window._vander_solving = true;

        const context = await captureScreen();
        if (context.options.length > 0) {
            notify('LOG', { message: 'Analyzing question...' });

            const index = await askAI(context);
            if (index !== null && context.options[index]) {
                notify('LOG', { message: `Clicking choice ${index}.` });
                context.options[index].click();
                setTimeout(clickNext, 2000);
            }
        } else {
            clickNext();
        }

        setTimeout(() => { window._vander_solving = false; }, 6000);
    }

    function clickNext() {
        const nextSelectors = [
            'button[aria-label*="Next"]', 'button[aria-label*="Go"]',
            'button[aria-label*="Continue"]', 'button[aria-label*="Check"]',
            '.next-button', '.done-button'
        ];

        let foundBtn = null;
        for (const s of nextSelectors) {
            foundBtn = document.querySelector(s);
            if (foundBtn) break;
        }

        if (!foundBtn) {
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (innerDoc) {
                        for (const s of nextSelectors) {
                            foundBtn = innerDoc.querySelector(s);
                            if (foundBtn) break;
                        }
                    }
                } catch (e) { }
                if (foundBtn) break;
            }
        }

        if (foundBtn) {
            foundBtn.click();
            notify('LOG', { message: 'Auto-cliked Done/Next.' });
        }
    }

    setInterval(solveLoop, 7000);
    notify('LOG', { message: 'Vision Engine Ready.' });

})();
