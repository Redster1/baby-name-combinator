class NameDial {
    constructor(textareaId, displayId, upButtonId, downButtonId) {
        this.textarea = document.getElementById(textareaId);
        this.display = document.getElementById(displayId);
        this.upButton = document.getElementById(upButtonId);
        this.downButton = document.getElementById(downButtonId);
        this.currentIndex = 0;
        this.names = [];

        this.textarea.addEventListener('change', () => this.updateNamesFromTextarea());
        this.textarea.addEventListener('input', () => this.updateNamesFromTextarea());
        this.upButton.addEventListener('click', () => this.scrollUp());
        this.downButton.addEventListener('click', () => this.scrollDown());
    }

    updateNamesFromTextarea() {
        this.names = this.textarea.value
            .split('\n')
            .map(name => name.trim())
            .filter(name => name.length > 0);

        if (this.names.length === 0) {
            this.currentIndex = 0;
            this.display.textContent = 'Select';
        } else {
            // Keep current index valid
            if (this.currentIndex >= this.names.length) {
                this.currentIndex = 0;
            }
            this.updateDisplay();
        }

        updateFullName();
    }

    scrollUp() {
        if (this.names.length === 0) return;
        this.currentIndex = (this.currentIndex - 1 + this.names.length) % this.names.length;
        this.updateDisplay();
        updateFullName();
    }

    scrollDown() {
        if (this.names.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.names.length;
        this.updateDisplay();
        updateFullName();
    }

    updateDisplay() {
        if (this.names.length > 0) {
            this.display.textContent = this.names[this.currentIndex];
        } else {
            this.display.textContent = 'Select';
        }
    }

    getCurrentName() {
        if (this.names.length === 0) return '';
        return this.names[this.currentIndex];
    }
}

// Initialize the three dials
const firstNameDial = new NameDial(
    'firstNamesList',
    'firstNameDisplay',
    'firstNameUp',
    'firstNameDown'
);

const middleNameDial = new NameDial(
    'middleNamesList',
    'middleNameDisplay',
    'middleNameUp',
    'middleNameDown'
);

const lastNameDial = new NameDial(
    'lastNamesList',
    'lastNameDisplay',
    'lastNameUp',
    'lastNameDown'
);

function updateFullName() {
    const firstName = firstNameDial.getCurrentName();
    const middleName = middleNameDial.getCurrentName();
    const lastName = lastNameDial.getCurrentName();

    let fullName = '';
    if (firstName) fullName += firstName;
    if (middleName) fullName += (fullName ? ' ' : '') + middleName;
    if (lastName) fullName += (fullName ? ' ' : '') + lastName;

    const fullNameElement = document.getElementById('fullName');
    fullNameElement.textContent = fullName || 'Name Combination';
}

// Initialize display
updateFullName();
