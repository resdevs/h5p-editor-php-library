/*global H5PEditor, H5P, ns, Darkroom*/
H5PEditor.ImageEditingPopup = (function ($, EventDispatcher) {
  var instanceCounter = 0;
  var scriptsLoaded = false;

  /**
   * Popup for editing images
   *
   * @param {number} [ratio] Ratio that cropping must keep
   * @constructor
   */
  function ImageEditingPopup(ratio) {
    EventDispatcher.call(this);
    var self = this;
    var uniqueId = instanceCounter;
    var isShowing = false;
    var isReset = false;
    var topOffset = 0;
    var maxWidth;
    var maxHeight;

    // Create elements
    var background = document.createElement('div');
    background.className = 'h5p-editing-image-popup-background hidden';

    var popup = document.createElement('div');
    popup.className = 'h5p-editing-image-popup';
    background.appendChild(popup);

    var header = document.createElement('div');
    header.className = 'h5p-editing-image-header';
    popup.appendChild(header);

    var headerTitle = document.createElement('div');
    headerTitle.className = 'h5p-editing-image-header-title';
    headerTitle.textContent = 'Edit Image!';
    header.appendChild(headerTitle);

    var headerButtons = document.createElement('div');
    headerButtons.className = 'h5p-editing-image-header-buttons';
    header.appendChild(headerButtons);

    var editingContainer = document.createElement('div');
    editingContainer.className = 'h5p-editing-image-editing-container';
    popup.appendChild(editingContainer);

    var imageLoading = document.createElement('div');
    imageLoading.className = 'h5p-editing-image-loading';
    imageLoading.textContent = ns.t('core', 'loadingImageEditor');
    popup.appendChild(imageLoading);

    // Create editing image
    var editingImage = new Image();
    editingImage.className = 'h5p-editing-image hidden';
    editingImage.id = 'h5p-editing-image-' + uniqueId;
    editingContainer.appendChild(editingImage);

    // Append to body
    H5P.$body.get(0).appendChild(background);

    // Close popup on background click
    background.onclick = function () {
      this.hide();
    }.bind(this);

    // Prevent closing popup
    popup.onclick = function (e) {
      e.stopPropagation();
    };

    // Make sure each ImageEditingPopup instance has a unique ID
    instanceCounter += 1;

    /**
     * Create header button
     *
     * @param {string} coreString Must be specified in core translations
     * @param {string} className Unique button identifier that will be added to classname
     * @param {function} clickEvent OnClick function
     */
    var createButton = function (coreString, className, clickEvent) {
      var button = document.createElement('button');
      button.textContent = ns.t('core', coreString);
      button.className = className;
      button.onclick = clickEvent;
      headerButtons.appendChild(button);
    };

    /**
     * Set max width and height for image editing tool
     */
    var setDarkroomDimensions = function () {

      // Set max dimensions
      var backgroundPaddingWidth = 16 * 2;
      var darkroomPadding = 32 * 2;
      maxWidth = H5P.$body.get(0).offsetWidth - backgroundPaddingWidth -
        darkroomPadding;

      // Only use 65% of screen height
      var maxScreenHeight = screen.height * 0.65;

      // Calculate editor max height
      var darkroomToolbarHeight = 40;
      var backgroundPaddingHeight = 48 * 2;
      var editorHeight = H5P.$body.get(0).offsetHeight -
        backgroundPaddingHeight - header.offsetHeight -
        darkroomToolbarHeight - darkroomPadding;

      // Use smallest of screen height and editor height,
      // we don't want to overflow editor or screen
      maxHeight = maxScreenHeight < editorHeight ? maxScreenHeight : editorHeight;
    };

    /**
     * Create image editing tool from image.
     */
    var createDarkroom = function () {
      window.requestAnimationFrame(function () {
        setDarkroomDimensions();

        self.darkroom = new Darkroom('#h5p-editing-image-' + uniqueId, {
          initialize: function () {
            // Reset transformations
            this.transformations = [];

            self.adjustPopupOffset();
            background.classList.remove('hidden');
            imageLoading.classList.add('hidden');
            self.trigger('initialized');
          },
          maxWidth: maxWidth,
          maxHeight: maxHeight,
          plugins: {
            crop: {
              ratio: ratio || null
            },
            save : false
          }
        });
      });
    };

    /**
     * Load a script dynamically
     *
     * @param {string} path Path to script
     * @param {function} [callback]
     */
    var loadScript = function (path, callback) {
      $.ajax({
        url: path,
        dataType: 'script',
        success: function () {
          if (callback) {
            callback();
          }
        },
        async: true
      });
    };

    /**
     * Load scripts dynamically
     */
    var loadScripts = function () {
      loadScript(H5PEditor.basePath + 'libs/fabric.js', function () {
        loadScript(H5PEditor.basePath + 'libs/darkroom.js', function () {
          createDarkroom();
          scriptsLoaded = true;
        });
      });
    };

    /**
     * Grab canvas data and pass data to listeners.
     */
    var saveImage = function () {

      var isCropped = self.darkroom.plugins.crop.hasFocus();
      var canvas = self.darkroom.canvas.getElement();

      var convertData = function () {
        var newImage = self.darkroom.canvas.toDataURL();
        self.trigger('savedImage', newImage);
        canvas.removeEventListener('crop:update', convertData, false);
      };

      // Check if image has changed
      if (self.darkroom.transformations.length || isReset || isCropped) {

        if (isCropped) {
          //self.darkroom.plugins.crop.okButton.element.click();
          self.darkroom.plugins.crop.cropCurrentZone();

          canvas.addEventListener('crop:update', convertData, false);
        } else {
          convertData();
        }
      }

      isReset = false;
    };

    /**
     * Adjust popup offset.
     * Make sure it is centered on top of offset.
     *
     * @param {Object} [offset] Offset that popup should center on.
     * @param {number} [offset.top] Offset to top.
     */
    this.adjustPopupOffset = function (offset) {
      if (offset) {
        topOffset = offset.top;
      }

      var offsetCentered = topOffset - (popup.offsetHeight / 2);

      // Min offset is 0
      offsetCentered = offsetCentered > 0 ? offsetCentered : 0;

      // Available editor height
      var backgroundStyle = window.getComputedStyle(background);
      var backgroundHeight = background.offsetHeight -
        parseInt(backgroundStyle['padding-top'], 10) -
        parseInt(backgroundStyle['padding-bottom'], 10);

      // Check that popup does not overflow editor
      if (popup.offsetHeight + offsetCentered > backgroundHeight) {
        var newOffset = backgroundHeight - popup.offsetHeight;
        offsetCentered = newOffset < 0 ? 0 : newOffset;
      }

      popup.style.top = offsetCentered + 'px';
    };

    /**
     * Set new image in editing tool
     *
     * @param {string} imgSrc Source of new image
     */
    this.setImage = function (imgSrc) {
      // Set new image
      var darkroom = popup.querySelector('.darkroom-container');
      if (darkroom) {
        darkroom.parentNode.removeChild(darkroom);
      }

      editingImage.src = imgSrc;
      imageLoading.classList.remove('hidden');
      editingImage.classList.add('hidden');
      editingContainer.appendChild(editingImage);

      createDarkroom();
    };

    /**
     * Show popup
     *
     * @param {Object} [offset] Offset that popup should center on.
     * @param {string} [imageSrc] Source of image that will be edited
     */
    this.show = function (offset, imageSrc) {
      if (imageSrc) {

        // Load image editing scripts dynamically
        if (!scriptsLoaded) {
          editingImage.src = imageSrc;
          loadScripts();
        }
        else {
          self.setImage(imageSrc);
        }
      }
      else {
        background.classList.remove('hidden');
        self.trigger('showedPopup');
      }

      isShowing = true;
      this.adjustPopupOffset(offset);
    };

    /**
     * Hide popup
     */
    this.hide = function () {
      isShowing = false;
      background.classList.add('hidden');
    };

    /**
     * Toggle popup visibility
     */
    this.toggle = function () {
      if (isShowing) {
        this.hide();
      } else {
        this.show();
      }
    };

    // Create header buttons
    createButton('resetToOriginalLabel', 'h5p-editing-image-reset-button h5p-remove', function () {
      self.trigger('resetImage');
      isReset = true;
    });
    createButton('cancelLabel', 'h5p-editing-image-cancel-button', function () {
      self.trigger('canceled');
      self.hide();
    });
    createButton('saveLabel', 'h5p-editing-image-save-button h5p-done', function () {
      saveImage();
      self.hide();
    });
  }

  ImageEditingPopup.prototype = Object.create(EventDispatcher.prototype);
  ImageEditingPopup.prototype.constructor = ImageEditingPopup;

  return ImageEditingPopup;

}(H5P.jQuery, H5P.EventDispatcher));
