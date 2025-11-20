class NameDial {
    constructor(textareaId, trackId, lockButtonId) {
        this.textarea = document.getElementById(textareaId);
        this.track = document.getElementById(trackId);
        this.lockButton = document.getElementById(lockButtonId);
        this.viewport = this.track.parentElement;

        // State
        this.names = [];
        this.currentPosition = 0; // Floating point for smooth scrolling
        this.targetPosition = 0;
        this.isAnimating = false;
        this.snapTimeout = null;
        this.isLocked = false;

        // Touch/drag state
        this.isDragging = false;
        this.dragStartY = 0;
        this.dragStartPosition = 0;
        this.lastDragY = 0;
        this.lastDragTime = 0;
        this.velocity = 0;

        // Constants
        this.VISIBLE_ITEMS = 7; // Show 7 items (3 above, center, 3 below)
        this.ITEM_HEIGHT = 44; // Height of each item in pixels
        this.SCALE_FACTOR = 0.125; // How much items scale down (at distance 3: 0.625 scale)
        this.OPACITY_FACTOR = 0.15; // How much items fade (at distance 3: 0.55 opacity)
        this.SNAP_DELAY = 150; // Delay before snapping to center

        // Event listeners
        this.textarea.addEventListener('input', () => this.updateNamesFromTextarea());
        this.lockButton.addEventListener('click', () => this.toggleLock());

        // Mouse wheel
        this.viewport.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // Touch events
        this.viewport.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.viewport.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.viewport.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Mouse drag events
        this.viewport.addEventListener('mousedown', (e) => this.handleMouseDown(e));

        // Store bound functions so we can remove them later
        this.boundMouseMove = (e) => this.handleMouseMove(e);
        this.boundMouseUp = (e) => this.handleMouseUp(e);

        // Keyboard navigation
        this.viewport.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Initialize
        this.updateNamesFromTextarea();
    }

    handleKeydown(event) {
        if (this.isLocked || this.names.length === 0) return;

        // Handle up/down arrows for name navigation
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            this.scrollUp();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            this.scrollDown();
        }
        // Left/right arrows are handled globally to switch between dials
    }

    updateNamesFromTextarea() {
        this.names = this.textarea.value
            .split('\n')
            .map(name => name.trim())
            .filter(name => name.length > 0);

        // Reset position if list changed
        if (this.names.length > 0) {
            this.currentPosition = Math.max(0, Math.min(this.currentPosition, this.names.length - 1));
            this.targetPosition = Math.round(this.currentPosition);
        } else {
            this.currentPosition = 0;
            this.targetPosition = 0;
        }

        this.renderWheel();
        updateFullName();
    }

    scrollUp() {
        if (this.names.length === 0) return;
        this.targetPosition = (this.targetPosition - 1 + this.names.length) % this.names.length;
        this.animateToTarget();
    }

    scrollDown() {
        if (this.names.length === 0) return;
        this.targetPosition = (this.targetPosition + 1) % this.names.length;
        this.animateToTarget();
    }

    toggleLock() {
        this.isLocked = !this.isLocked;
        if (this.isLocked) {
            this.lockButton.classList.add('locked');
            this.lockButton.textContent = '🔒';
        } else {
            this.lockButton.classList.remove('locked');
            this.lockButton.textContent = '🔓';
        }
    }

    handleWheel(event) {
        if (this.isLocked || this.names.length === 0) return;
        event.preventDefault();

        // Normalize wheel delta
        const delta = event.deltaY > 0 ? 0.5 : -0.5;

        // Update position
        this.currentPosition += delta;

        // Wrap around
        while (this.currentPosition < 0) this.currentPosition += this.names.length;
        while (this.currentPosition >= this.names.length) this.currentPosition -= this.names.length;

        this.renderWheel();
        this.scheduleSnap();
    }

    handleTouchStart(event) {
        if (this.isLocked || this.names.length === 0) return;
        event.preventDefault();

        this.isDragging = true;
        this.dragStartY = event.touches[0].clientY;
        this.dragStartPosition = this.currentPosition;
        this.lastDragY = event.touches[0].clientY;
        this.lastDragTime = Date.now();
        this.velocity = 0;

        // Cancel any ongoing animations
        this.isAnimating = false;
        if (this.snapTimeout) {
            clearTimeout(this.snapTimeout);
            this.snapTimeout = null;
        }
    }

    handleTouchMove(event) {
        if (!this.isDragging || this.names.length === 0) return;
        event.preventDefault();

        const currentY = event.touches[0].clientY;
        const deltaY = currentY - this.dragStartY;
        const currentTime = Date.now();

        // Calculate velocity for momentum
        const timeDelta = currentTime - this.lastDragTime;
        if (timeDelta > 0) {
            this.velocity = (currentY - this.lastDragY) / timeDelta;
        }

        this.lastDragY = currentY;
        this.lastDragTime = currentTime;

        // Convert pixels to position delta
        const positionDelta = -deltaY / this.ITEM_HEIGHT;
        this.currentPosition = this.dragStartPosition + positionDelta;

        // Wrap around
        while (this.currentPosition < 0) this.currentPosition += this.names.length;
        while (this.currentPosition >= this.names.length) this.currentPosition -= this.names.length;

        this.renderWheel();
    }

    handleTouchEnd(event) {
        if (!this.isDragging) return;
        this.isDragging = false;

        // Apply momentum if velocity is significant
        if (Math.abs(this.velocity) > 0.5) {
            this.applyMomentum();
        } else {
            this.scheduleSnap();
        }
    }

    handleMouseDown(event) {
        if (this.isLocked || this.names.length === 0) return;
        event.preventDefault();

        this.isDragging = true;
        this.dragStartY = event.clientY;
        this.dragStartPosition = this.currentPosition;
        this.lastDragY = event.clientY;
        this.lastDragTime = Date.now();
        this.velocity = 0;

        // Add document-level listeners for dragging
        document.addEventListener('mousemove', this.boundMouseMove);
        document.addEventListener('mouseup', this.boundMouseUp);

        // Cancel any ongoing animations
        this.isAnimating = false;
        if (this.snapTimeout) {
            clearTimeout(this.snapTimeout);
            this.snapTimeout = null;
        }
    }

    handleMouseMove(event) {
        if (!this.isDragging || this.names.length === 0) return;

        const currentY = event.clientY;
        const deltaY = currentY - this.dragStartY;
        const currentTime = Date.now();

        // Calculate velocity for momentum
        const timeDelta = currentTime - this.lastDragTime;
        if (timeDelta > 0) {
            this.velocity = (currentY - this.lastDragY) / timeDelta;
        }

        this.lastDragY = currentY;
        this.lastDragTime = currentTime;

        // Convert pixels to position delta
        const positionDelta = -deltaY / this.ITEM_HEIGHT;
        this.currentPosition = this.dragStartPosition + positionDelta;

        // Wrap around
        while (this.currentPosition < 0) this.currentPosition += this.names.length;
        while (this.currentPosition >= this.names.length) this.currentPosition -= this.names.length;

        this.renderWheel();
    }

    handleMouseUp(event) {
        if (!this.isDragging) return;
        this.isDragging = false;

        // Remove document-level listeners
        document.removeEventListener('mousemove', this.boundMouseMove);
        document.removeEventListener('mouseup', this.boundMouseUp);

        // Apply momentum if velocity is significant
        if (Math.abs(this.velocity) > 0.5) {
            this.applyMomentum();
        } else {
            this.scheduleSnap();
        }
    }

    applyMomentum() {
        const friction = 0.95;
        const minVelocity = 0.05;

        const animate = () => {
            // Apply velocity
            this.currentPosition -= this.velocity * 10;

            // Wrap around
            while (this.currentPosition < 0) this.currentPosition += this.names.length;
            while (this.currentPosition >= this.names.length) this.currentPosition -= this.names.length;

            // Apply friction
            this.velocity *= friction;

            this.renderWheel();

            // Continue if velocity is significant
            if (Math.abs(this.velocity) > minVelocity) {
                requestAnimationFrame(animate);
            } else {
                this.scheduleSnap();
            }
        };

        animate();
    }

    scheduleSnap() {
        if (this.snapTimeout) {
            clearTimeout(this.snapTimeout);
        }

        this.snapTimeout = setTimeout(() => {
            this.snapToNearest();
        }, this.SNAP_DELAY);
    }

    snapToNearest() {
        this.targetPosition = Math.round(this.currentPosition) % this.names.length;
        this.animateToTarget();
    }

    animateToTarget() {
        if (this.names.length === 0) return;

        this.isAnimating = true;
        const startPosition = this.currentPosition;
        const endPosition = this.targetPosition;

        // Calculate shortest path (handle wrapping)
        let delta = endPosition - startPosition;
        if (Math.abs(delta) > this.names.length / 2) {
            if (delta > 0) {
                delta -= this.names.length;
            } else {
                delta += this.names.length;
            }
        }

        const duration = 250; // milliseconds
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-out cubic)
            const eased = 1 - Math.pow(1 - progress, 3);

            this.currentPosition = startPosition + delta * eased;

            // Wrap around
            while (this.currentPosition < 0) this.currentPosition += this.names.length;
            while (this.currentPosition >= this.names.length) this.currentPosition -= this.names.length;

            this.renderWheel();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.currentPosition = this.targetPosition;
                this.isAnimating = false;
                this.renderWheel();
                updateFullName();
            }
        };

        animate();
    }

    renderWheel() {
        if (this.names.length === 0) {
            this.track.innerHTML = '<div class="scroll-wheel-item" style="opacity: 0.5;">No names</div>';
            return;
        }

        // Clear existing items
        this.track.innerHTML = '';

        // Calculate center index
        const centerIndex = Math.round(this.currentPosition);
        const fractionalOffset = this.currentPosition - centerIndex;

        // Render visible items
        const halfVisible = Math.floor(this.VISIBLE_ITEMS / 2);

        for (let i = -halfVisible; i <= halfVisible; i++) {
            const index = (centerIndex + i + this.names.length) % this.names.length;
            const name = this.names[index];

            // Calculate distance from center (accounting for fractional offset)
            const distance = i - fractionalOffset;

            // Create item element
            const item = document.createElement('div');
            item.className = 'scroll-wheel-item';
            item.textContent = name;

            // Apply transform based on distance
            const translateY = distance * this.ITEM_HEIGHT;
            const scale = 1.0 - Math.abs(distance) * this.SCALE_FACTOR;
            const opacity = 1.0 - Math.abs(distance) * this.OPACITY_FACTOR;

            // Clamp values
            const finalScale = Math.max(0.5, Math.min(1.0, scale));
            const finalOpacity = Math.max(0.2, Math.min(1.0, opacity));

            item.style.transform = `translateY(${translateY}px) scale(${finalScale})`;
            item.style.opacity = finalOpacity;

            // Mark center item as selected
            if (Math.abs(distance) < 0.1) {
                item.classList.add('selected');
            }

            this.track.appendChild(item);
        }
    }

    getCurrentName() {
        if (this.names.length === 0) return '';
        const index = Math.round(this.currentPosition) % this.names.length;
        return this.names[index];
    }
}

// Global flag to track if all dials are initialized
let allDialsInitialized = false;

// Initialize the three dials
const firstNameDial = new NameDial(
    'firstNamesList',
    'firstNameTrack',
    'firstNameLock'
);

const middleNameDial = new NameDial(
    'middleNamesList',
    'middleNameTrack',
    'middleNameLock'
);

const lastNameDial = new NameDial(
    'lastNamesList',
    'lastNameTrack',
    'lastNameLock'
);

// Mark dials as initialized
allDialsInitialized = true;

// Array of dials for keyboard navigation
const dials = [firstNameDial, middleNameDial, lastNameDial];
const dialOrder = ['first', 'middle', 'last'];

// Global keyboard handler for switching between dials
document.addEventListener('keydown', (event) => {
    // Only handle left/right arrows
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

    // Check if any dial viewport is focused
    const focusedElement = document.activeElement;
    if (!focusedElement.classList.contains('scroll-wheel-viewport')) return;

    const currentDialType = focusedElement.getAttribute('data-dial');
    const currentIndex = dialOrder.indexOf(currentDialType);

    if (currentIndex === -1) return;

    event.preventDefault();

    let newIndex;
    if (event.key === 'ArrowLeft') {
        // Move to previous dial (wrap around)
        newIndex = (currentIndex - 1 + dials.length) % dials.length;
    } else {
        // Move to next dial (wrap around)
        newIndex = (currentIndex + 1) % dials.length;
    }

    // Focus the new dial's viewport
    dials[newIndex].viewport.focus();
});

function updateFullName() {
    // Only run if all dials are initialized
    if (!allDialsInitialized) {
        return;
    }

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

// Floating names background animation
function createFloatingNames() {
    const container = document.getElementById('floatingNames');
    if (!container) return;

    const babyNames = [
        'Olivia', 'Emma', 'Ava', 'Sophia', 'Charlotte', 'Amelia', 'Isabella', 'Mia', 'Luna', 'Harper',
        'Liam', 'Noah', 'Oliver', 'Elijah', 'James', 'William', 'Benjamin', 'Lucas', 'Henry', 'Theodore',
        'Grace', 'Rose', 'Mae', 'Elizabeth', 'Marie', 'Jane', 'Claire', 'Kate', 'Anne', 'Joy',
        'Alexander', 'Michael', 'Daniel', 'Matthew', 'Joseph', 'David', 'Samuel', 'Jackson', 'Sebastian'
    ];

    function createFloatingName() {
        const name = babyNames[Math.floor(Math.random() * babyNames.length)];
        const nameEl = document.createElement('div');
        nameEl.className = 'floating-name';
        nameEl.textContent = name;

        // Random starting position
        const startY = Math.random() * 100;
        nameEl.style.top = startY + '%';

        // Random size
        const fontSize = 16 + Math.random() * 28; // 16-44px
        nameEl.style.fontSize = fontSize + 'px';

        // Random animation duration
        const duration = 15 + Math.random() * 15; // 15-30 seconds
        nameEl.style.animationDuration = duration + 's';

        // Random animation delay
        const delay = Math.random() * 10;
        nameEl.style.animationDelay = delay + 's';

        container.appendChild(nameEl);

        // Remove after animation completes
        setTimeout(() => {
            nameEl.remove();
        }, (duration + delay) * 1000);
    }

    // Create initial set of names
    for (let i = 0; i < 15; i++) {
        setTimeout(() => createFloatingName(), i * 800);
    }

    // Continuously add new names
    setInterval(createFloatingName, 2000);
}

// Start floating names animation
createFloatingNames();
