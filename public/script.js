
// This event listener toggles the dropdown menu for the bars icon
document.getElementById('bars-icon').addEventListener('click', function(event) {
  event.preventDefault();
  event.stopPropagation(); // Stop the click from propagating
  var dropdown = document.querySelector('.dropdown-menu');
  dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
});

// This function closes the dropdown menu if clicked outside
window.onclick = function(event) {
  if (!event.target.matches('#bars-icon')) {
    var dropdowns = document.getElementsByClassName("dropdown-menu");
    for (var i = 0; i < dropdowns.length; i++) {
      var openDropdown = dropdowns[i];
      if (openDropdown.style.display === "block") {
        openDropdown.style.display = "none";
      }
    }
  }
};

function addToCart(productId, quantity) {
  console.log('Adding to cart', productId, quantity);
  fetch('/add-to-cart', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, quantity }),
  })
  .then(response => response.json())
  .then(data => {
      console.log('Success:', data);
      alert('Item added to cart successfully');
  })
  .catch((error) => {
      console.error('Error:', error);
      alert('Error adding item to cart');
  });
};

function removeFromCart(buttonElement) {
  console.log(buttonElement);
  var itemId = buttonElement.getAttribute('data-item-id'); // Make sure this is an integer
  console.log('Item ID to remove:', itemId);

  itemId = parseInt(itemId, 10);
  console.log('Parsed Item ID:', itemId);

  if (!itemId) {
    // If itemId is not valid (NaN), handle the error.
    alert('Invalid item ID.');
    return;
  }

  // Make a request to your server to remove the item
  fetch('/remove-from-cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ itemId: itemId })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // If the server responds that the item was removed, update the UI accordingly
      buttonElement.closest('.shopping-cart-item').remove();
      // Update the subtotal, tax, and total elements in your page
      updateSummary();
    } else {
      // Handle failure
      alert('Failed to remove item from cart.');
    }
  })
  .catch(error => {
    console.error('Error removing item from cart:', error);
    alert('There was a problem removing the item from the cart.');
  });
};

function updateSummary() {
  // Define variables for subtotal, taxRate, and total
  let subtotal = 0;
  let taxRate = 0.06; // Example tax rate
  let total;

  // Get all the item prices from the UI and sum them to calculate the new subtotal
  document.querySelectorAll('.item-price').forEach(function(priceElement) {
    let price = parseFloat(priceElement.textContent.replace('Price: $', ''));
    subtotal += price;
  });

  // Calculate the new tax and total
  let taxAmount = subtotal * taxRate;
  total = subtotal + taxAmount;

  // Update the UI elements with the new values only if they exist
  //let subtotalElement = document.querySelector('.subtotal');
  //let taxElement = document.querySelector('.tax');
  //let totalElement = document.querySelector('.total');

  //if (subtotalElement) subtotalElement.textContent = 'Subtotal: $' + subtotal.toFixed(2);
  //if (taxElement) taxElement.textContent = 'Tax: $' + taxAmount.toFixed(2);
  //if (totalElement) totalElement.textContent = 'Total: $' + total.toFixed(2);

  // Attempt to find and log the UI elements for subtotal, tax, and total
  let subtotalElement = document.querySelector('.subtotal');
  console.log('subtotalElement:', subtotalElement); // Log to check if the element is found

  let taxElement = document.querySelector('.tax');
  console.log('taxElement:', taxElement); // Log to check if the element is found

  let totalElement = document.querySelector('.total');
  console.log('totalElement:', totalElement); // Log to check if the element is found

  // Update the UI elements with the new values only if they exist
  if (subtotalElement) {
    subtotalElement.textContent = 'Subtotal: $' + subtotal.toFixed(2);
  } else {
    console.error('Could not find the subtotal element.');
  }

  if (taxElement) {
    taxElement.textContent = 'Tax: $' + taxAmount.toFixed(2);
  } else {
    console.error('Could not find the tax element.');
  }

  if (totalElement) {
    totalElement.textContent = 'Total: $' + total.toFixed(2);
  } else {
    console.error('Could not find the total element.');
  }
};

document.addEventListener('DOMContentLoaded', function () {
  var saveButton = document.getElementById('save-button');
  if (saveButton) {
    saveButton.addEventListener('click', function() {
      var form = document.getElementById('profile-form');
      if (form) {
        var formData = new FormData(form);

        // Check if the password field is empty, and if so, delete it from the formData
        if (!formData.get('password')) {
          formData.delete('password');
        }

        var formBody = new URLSearchParams(formData).toString();

        fetch('/update-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBody
        })
        .then(response => response.json())
        .then(data => {
          console.log('Success:', data);
          if (data.success) {
            alert('Profile updated successfully!');
          } else {
            // Provide more detailed feedback to the user
            alert('Failed to update profile: ' + (data.errors.map(e => e.msg).join(', ') || data.message));
          }
        })
        .catch((error) => {
          console.error('Error:', error);
          alert('Error updating profile.');
        });
      } else {
        console.error('Profile form not found!');
      }
    });
  } else {
    console.error('Save button not found!');
  }
});

function redirectToCheckout() {
  window.location.href = '/checkOut';
};