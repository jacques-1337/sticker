// app.js

// Event listeners
const buttons = document.querySelectorAll('button');
buttons.forEach(button => {
    button.addEventListener('click', (event) => {
        console.log(`Button ${event.target.innerText} clicked`);
        // Handle button click event
    });
});

// Application state management
let appState = {
    user: null,
    items: [],
};

function updateUser(user) {
    appState.user = user;
    console.log('User updated:', appState.user);
}

function addItem(item) {
    appState.items.push(item);
    console.log('Item added:', item);
    console.log('Current items:', appState.items);
}