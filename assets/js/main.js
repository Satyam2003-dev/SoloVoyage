document.addEventListener('DOMContentLoaded', function () {
  
  /**
   * Initializes the Animate On Scroll (AOS) library.
   * This adds the fade-up effects to content cards as they enter the viewport.
   */
  AOS.init({
    duration: 800, // Animation duration in milliseconds
    once: true,    // Ensures the animation only happens once per element
  });

  // --- DOM Element Selection ---
  const header = document.getElementById('header');
  const mobileMenuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');

  /**
   * Handles the sticky header's visual change on scroll.
   * When the user scrolls down more than 50 pixels, the 'scrolled' class is added
   * to the header. This class applies a background color and shadow via CSS,
   * making the navigation readable against the page content that scrolls underneath it.
   * It is removed when the user scrolls back to the top.
   */
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  /**
   * Toggles the visibility of the mobile navigation menu.
   * When the hamburger icon button is clicked, this function toggles the 'hidden' 
   * utility class on the mobile menu container, making it appear or disappear.
   */
  if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', (event) => {
      // Stop the click from propagating to the document, which would immediately close the menu.
      event.stopPropagation();
      mobileMenu.classList.toggle('hidden');
    });
  }

  /**
   * Closes the mobile menu when a user clicks anywhere outside of it.
   * This provides a more intuitive user experience on mobile devices.
   */
  document.addEventListener('click', (event) => {
    // Check if the mobile menu exists and is currently visible
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
      const isClickInsideMenu = mobileMenu.contains(event.target);
      const isClickOnButton = mobileMenuButton.contains(event.target);

      // If the click was not inside the menu and not on the menu button, hide the menu.
      if (!isClickInsideMenu && !isClickOnButton) {
        mobileMenu.classList.add('hidden');
      }
    }
  });

});