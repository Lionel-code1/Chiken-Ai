import { marked } from "marked";

const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatContainer = document.getElementById('chat-container');
const fileInput = document.getElementById('file-input');
const filePreviewContainer = document.getElementById('file-preview-container');

let conversationHistory = [];
let attachedFile = null;

// System prompt for the AI
const systemPrompt = {
    role: "system",
    content: "You are Chiken AI, a helpful and slightly quirky assistant represented by a funny duck. Your responses should be helpful, concise, and formatted with markdown. You can analyze images provided by the user. If the user asks you to create, draw, or generate an image, you must respond with only a JSON object like this: {\"tool\": \"image_generation\", \"prompt\": \"A detailed English description of the image to generate\"}. For all other requests, including analyzing an image provided by the user or having a conversation, respond with a normal text message."
};

conversationHistory.push(systemPrompt);

// Handle file attachment
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
            attachedFile = {
                url: event.target.result,
                type: file.type
            };
            displayFilePreview();
        };
        reader.readAsDataURL(file);
    } else {
        attachedFile = null;
        clearFilePreview();
        if (file) {
             addMessage('ai', 'Sorry, ich kann nur Bilder analysieren.');
        }
    }
});

function displayFilePreview() {
    filePreviewContainer.innerHTML = `
        <img src="${attachedFile.url}" alt="Preview" id="file-preview">
        <button id="remove-file-button" onclick="removeAttachedFile()">&times;</button>
    `;
}

// Make remove function global
window.removeAttachedFile = () => {
    attachedFile = null;
    fileInput.value = ''; // Clear the file input
    clearFilePreview();
}

function clearFilePreview() {
    filePreviewContainer.innerHTML = '';
}

// Function to add a message to the chat log
function addMessage(sender, messageContent, isHtml = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);
    
    if (isHtml) {
        messageElement.innerHTML = messageContent;
    } else {
        messageElement.textContent = messageContent;
    }
    chatLog.appendChild(messageElement);
    scrollToBottom();
    return messageElement;
}

// Function to scroll chat to the bottom
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Show initial welcome message
function showWelcomeMessage() {
    const welcomeText = "Hallo! Ich bin Chiken AI. Was können wir heute zusammen entdecken? Du kannst mir eine Frage stellen, ein Bild zum Analysieren schicken oder mich bitten, ein Bild für dich zu malen!";
    const aiMessageElement = addMessage('ai', '');
    aiMessageElement.innerHTML = marked.parse(welcomeText);
    conversationHistory.push({ role: 'assistant', content: welcomeText });
}

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userMessageText = userInput.value.trim();

    if (!userMessageText && !attachedFile) return;

    // Construct user message for display
    let userMessageDisplay = '';
    if (attachedFile) {
        userMessageDisplay += `<img src="${attachedFile.url}" alt="User upload" style="max-width: 200px; border-radius: 10px; margin-bottom: 5px;" />`;
    }
    if (userMessageText) {
        userMessageDisplay += `<p style="margin:0;">${userMessageText}</p>`;
    }
    addMessage('user', userMessageDisplay, true);

    // Construct user message for API
    const userMessageForApi = { role: 'user', content: [] };
    if (userMessageText) {
        userMessageForApi.content.push({ type: 'text', text: userMessageText });
    }
    if (attachedFile) {
        userMessageForApi.content.push({ type: 'image_url', image_url: { url: attachedFile.url } });
         if (!userMessageText) {
             // Add a default prompt if only an image is sent
            userMessageForApi.content.unshift({ type: 'text', text: 'Was siehst du auf diesem Bild?' });
        }
    }
    
    conversationHistory.push(userMessageForApi);
    userInput.value = '';
    window.removeAttachedFile();
    
    const loadingElement = addMessage('loading', "<span></span><span></span><span></span>", true);

    try {
        const completion = await websim.chat.completions.create({
            model: "gpt-4o", // Using a vision-capable model
            messages: conversationHistory,
        });

        const aiResponse = completion.content;
        let responseForDisplay;
        let responseForHistory;

        try {
            // Check if the response is a JSON for image generation
            const parsedResponse = JSON.parse(aiResponse);
            if (parsedResponse.tool === 'image_generation' && parsedResponse.prompt) {
                addMessage('ai', `Okay, ich male folgendes: ${parsedResponse.prompt}`);
                responseForDisplay = await generateImage(parsedResponse.prompt);
                responseForHistory = "Hier ist das Bild, das du wolltest.";
            } else {
                // It's a JSON but not the one we want, treat as text
                throw new Error("Not an image generation command.");
            }
        } catch (jsonError) {
            // Not a JSON response, so it's a regular chat message
            responseForDisplay = marked.parse(aiResponse);
            responseForHistory = aiResponse;
        }

        loadingElement.remove();
        const aiMessageElement = addMessage('ai', '');
        aiMessageElement.innerHTML = responseForDisplay;
        
        conversationHistory.push({ role: 'assistant', content: responseForHistory });
        
        // Keep conversation history from getting too long
        if (conversationHistory.length > 11) {
            conversationHistory.splice(1, 2); // Remove the oldest user/assistant pair
        }

    } catch (error) {
        console.error('Error:', error);
        loadingElement.remove();
        addMessage('ai', 'Entschuldigung, da ist etwas schief gelaufen. Bitte versuche es erneut.');
    }
});

async function generateImage(prompt) {
    const imageResult = await websim.imageGen({ prompt });
    return `<p>Hier ist dein Bild:</p><img src="${imageResult.url}" alt="${prompt}">`;
}

// Start the conversation
showWelcomeMessage();