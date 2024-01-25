if(process.env.NODE_ENV !== "production"){
  require('dotenv').config();
}

//Importing libraries that were installed using npm
const express = require(`express`);
const app = express();
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const passport = require("passport");
const initializePassport = require("./passport-config");
const saltRounds = 10;
const flash = require("connect-flash");
const session = require("express-session");
const pgSession = require('connect-pg-simple')(session);
const { body, validationResult } = require('express-validator');
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const fs = require('fs'); 

// PostgreSQL pool initialization
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: true,  // This ensures that SSL is used and the server is verified
    ca: fs.readFileSync(process.env.SSL_CERT_PATH).toString()
  }
});


initializePassport(passport, getUserByEmail, getUserById);


app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // line to tell Express to serve static files from the 'public' directory


app.use(flash())
app.use(session({
  store: new pgSession({
    pool: pool, // Use the existing pool
    tableName: 'session' // Use your custom table name; it defaults to 'session'
  }),
  secret: process.env.SESSION_SECRET, 
  resave: false, // will not resave session variable if nothing changed
  saveUninitialized: true, // This will create a session even for users who are not logged in
  cookie: { secure: false } // Set to true if using HTTPS+

}))

app.use(passport.initialize())
app.use(passport.session())


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes Start 
//use app.get(`/index`, (req, res) => { for localhost for testing only
app.get(`/`, (req, res) => {
  res.render('index', { user: req.user });
});

app.get(`/login`, (req, res) => {
    res.render('login', { messages: { error: req.flash('error') } });
});

app.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { 
      return next(err); 
    }
    res.redirect('/');
  });
});

app.get(`/register`, (req, res) => {
    res.render(`register`)
});

app.get('/stamps', async (req, res) => {
  try {
      const result = await pool.query('SELECT * FROM products WHERE category = $1 ORDER BY product_id', ['stamp']);

      // Filter products to include only those with stock_quantity > 0
      const availableProducts = result.rows.filter(product => product.stock_quantity > 0);
      
      // Process the products to ensure the price is correctly formatted
      const processedProducts = availableProducts.map(product => {
        return {
          ...product,
          // Convert the price to a number and fix to two decimal places
          price: Number(product.price).toFixed(2)
        };
      });

      // Pass the processed products to your 'stamps' EJS template
      console.log(processedProducts);
      res.render('stamps', { products: processedProducts, user: req.user || null });
  } catch (error) {
      console.error('Error fetching stamps:', error);
      res.status(500).send("Error loading stamps.");
  }
});

app.get('/comics', async (req, res) => {
  try {
      const result = await pool.query('SELECT * FROM products WHERE category = $1 ORDER BY product_id', ['comic']);
      
      // Process the products to ensure the price is correctly formatted
      const processedProducts = result.rows.map(product => {
        return {
          ...product,
          // Convert the price to a number and fix to two decimal places
          price: Number(product.price).toFixed(2)
        };
      });

      // Pass the processed products to your 'stamps' EJS template
      console.log(processedProducts);
      res.render('comics', { products: processedProducts, user: req.user || null });
  } catch (error) {
      console.error('Error fetching comics:', error);
      res.status(500).send("Error loading comics.");
  }
});

app.get(`/notFound`, (req, res) => {
  res.render(`notFound`, { user: req.user || null });
});

app.get(`/profile`, (req, res) => {
  res.render(`profile`, { user: req.user || null });
});

app.get(`/shoppingCart`, async (req, res) => {
  const sessionId = req.session.id; // This will be the session ID for a guest
  const userId = req.user ? req.user.id : null; // This will be the user ID if logged in
  

  try {
    let cartItems;
    if (userId) {
      // Fetch cart items for a logged-in user 
      const result = await pool.query(`
        SELECT c.id AS cart_id, p.*, c.quantity
        FROM cart c
        JOIN products p ON c.product_id = p.product_id
        WHERE c.user_id = $1 
      `, [userId]);
      cartItems = result.rows;
    } else {
      // Fetch cart items for a guest user
      const result = await pool.query(`
        SELECT c.id AS cart_id, p.*, c.quantity 
        FROM cart c
        JOIN products p ON c.product_id = p.product_id
        WHERE c.session_id = $1
      `, [sessionId]);
      cartItems = result.rows;
    }
    console.log("Cart items being sent to EJS:", cartItems);
    // Render the shopping cart page with the cart items
    res.render('shoppingCart', { cartItems: cartItems, user: req.user || null });
  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).send("Error loading the shopping cart.");
  }
});

app.get(`/checkOut`, async (req, res) => {
  const sessionId = req.session.id; // This will be the session ID for a guest
  const userId = req.user ? req.user.id : null; // This will be the user ID if logged in

  try {
    let cartItems;
    if (userId) {
      // Fetch cart items for a logged-in user
      const result = await pool.query(`
        SELECT c.id AS cart_id, p.*, c.quantity
        FROM cart c
        JOIN products p ON c.product_id = p.product_id
        WHERE c.user_id = $1
      `, [userId]);
      cartItems = result.rows;
    } else {
      // Fetch cart items for a guest user
      const result = await pool.query(`
        SELECT c.id AS cart_id, p.*, c.quantity 
        FROM cart c
        JOIN products p ON c.product_id = p.product_id
        WHERE c.session_id = $1
      `, [sessionId]);
      cartItems = result.rows;
    }

    // Calculate subtotal and total
    let subtotal = 0;
    cartItems.forEach(item => {
      subtotal += item.price * item.quantity;
    });
    let taxRate = 0.06; // Example tax rate
    let taxAmount = subtotal * taxRate;
    let total = subtotal + taxAmount;

    // Render the checkout page with cart items and totals
    res.render('checkOut', { cartItems: cartItems, subtotal: subtotal, taxAmount: taxAmount, total: total, user: req.user || null });
  } catch (error) {
    console.error('Error fetching cart items for checkout:', error);
    res.status(500).send("Error loading the checkout page.");
  }
});

app.get(`/thankYou`, (req, res) => {
  res.render(`thankYou`, { user: req.user || null });
});

app.get(`/invoice`, (req, res) => {
  res.render(`invoice`);
});

app.get(`/contactUs`, (req, res) => {
  res.render(`contactUs`, { user: req.user || null });
});

app.get('/search', async (req, res) => {
  // Normalize the search query by removing spaces, dashes, and hash symbols
  const searchQuery = req.query.query.replace(/[-#\s]/g, '');

  try {
    // Search for the product by name, ignoring spaces, dashes, and hash symbols
    const results = await pool.query(`
      SELECT * FROM products WHERE REPLACE(REPLACE(REPLACE(product_name, ' ', ''), '-', ''), '#', '') ILIKE $1
    `, [`%${searchQuery}%`]);

    if (results.rows.length > 0) {
      const category = results.rows[0].category;
      
      if (category === 'stamp') {
        res.redirect('/stamps');
      } else if (category === 'comic') {
        res.redirect('/comics');
      } else {
        res.redirect('/');
      }
    } else {
      res.redirect('/notFound');
    }
  } catch (err) {
    console.error('Error executing search query', err.stack);
    res.redirect('/notFound');
  }
});

//Routes End

// user retrieval from a PostgreSQL database 

async function getUserByEmail(email) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      return result.rows[0];
    } else {
      return null; // No user found with that email
    }
  } catch (err) {
    console.error('Error executing query', err.stack);
    return null;
  }
};

async function getUserById(id) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      return result.rows[0]; // Found user by ID
    } else {
      return null; // No user found with that ID
    }
  } catch (err) {
    console.error('Error executing query', err.stack);
    return null;
  }
};
// user retrieval from a PostgreSQL database end

//Defining migrate cart items

async function migrateCartItems(sessionId, userId) {
  await pool.query(`
    UPDATE cart SET user_id = $2, session_id = NULL
    WHERE session_id = $1 AND user_id IS NULL
  `, [sessionId, userId]);
  // Handle merging conflicts here if necessary
};

//Defining migrate cart items end


//  A simple query to test the connection and query execution in server.js:
pool.query('SELECT * FROM users', (error, results) => {
    if (error) {
      throw error;
    }
    //console.log(results.rows);
});
//end


//Bcrypt Start 

app.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Store user in the database with the hashed password
    const newUser = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
      [username, email, hashedPassword]
    );

    const userId = newUser.rows[0].id; // Get the ID of the newly registered user.
    const sessionId = req.session.id; // Get the session ID of the guest user.

    // Migrate any session cart items to the new user ID.
    await migrateCartItems(sessionId, userId);

    // Automatically log in the new user after registration.
    req.login(newUser.rows[0], err => {
      if (err) {
        console.error('Error during auto-login after registration:', err);
        return res.redirect('/login');
      }
      // Redirect to the home page or cart page after registration and login.
      res.redirect('/');
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).send("Server error");
  }
});

//Bcrypt End

//passport login

app.post("/login", passport.authenticate("local", {
  failureRedirect: "/login",
  failureFlash: true // Enable flash messages for login failures
}), async (req, res) => {
  const sessionId = req.session.id;
  const userId = req.user.id;

  try {
    // Migrate any session cart items to the user ID.
    await migrateCartItems(sessionId, userId);
    
    // Redirect to the home page or cart page after login.
    res.redirect('/profile'); 
  } catch (error) {
    console.error('Error migrating cart items on login:', error);
    res.status(500).send("Server error");
  }
});

//passport login End

//add item to cart

app.post('/add-to-cart', async (req, res) => {
  const { productId, quantity } = req.body;
  const sessionId = req.session.id; // Use the session ID from express-session
  const userId = req.user ? req.user.id : null;

  // Convert productId to an integer if it's a string
  const productIdInt = parseInt(productId, 10);
  

  try {
    // First, check the available stock for the product
    const stockCheck = await pool.query('SELECT stock_quantity FROM products WHERE product_id = $1', [productIdInt]);
    if (stockCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const availableStock = stockCheck.rows[0].stock_quantity;

    // If requested quantity exceeds available stock, return an error
    if (quantity > availableStock) {
      return res.status(400).json({ message: 'Requested quantity exceeds available stock' });
    }

    // Choose the ON CONFLICT clause based on whether userId is not null
    const onConflictClause = userId 
      ? 'ON CONFLICT ON CONSTRAINT cart_user_product_idx DO UPDATE SET quantity = cart.quantity + EXCLUDED.quantity'
      : 'ON CONFLICT ON CONSTRAINT cart_session_product_idx DO UPDATE SET quantity = cart.quantity + EXCLUDED.quantity';


    const addOrUpdateItem = await pool.query(`
      INSERT INTO cart (user_id, product_id, quantity, session_id)
      VALUES ($1, $2, $3, $4)
      ${onConflictClause}
    `, [userId, productIdInt, quantity, sessionId]);

    // Update the product stock
    await pool.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE product_id = $2', [quantity, productIdInt]);

    res.json({ message: 'Item added to cart successfully' });
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ message: 'Error adding item to cart' });
  }
});
app.post('/remove-from-cart', async (req, res) => {
  console.log('Request to remove from cart:', req.body);
  const itemId = parseInt(req.body.itemId);
  console.log(`Parsed item ID: ${itemId}`);
  const userId = req.user ? req.user.id : null; // to track user ID

  // Check if the parsing resulted in a valid integer
  if (isNaN(itemId)) {
    return res.status(400).json({ success: false, error: 'Invalid item ID' });
  }

  // Remove the item from the cart in the database
  try {
    // First, get the product ID and quantity from the cart item
    const cartItemResult = await pool.query('SELECT product_id, quantity FROM cart WHERE id = $1', [itemId]);
    if (cartItemResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Cart item not found' });
    }
    const { product_id, quantity } = cartItemResult.rows[0];

    await pool.query('DELETE FROM cart WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)', [itemId, userId]);
    console.log(`Deletion query executed for item ID ${itemId}`);

    // Update the stock quantity in the products table
    await pool.query('UPDATE products SET stock_quantity = stock_quantity + $1 WHERE product_id = $2', [quantity, product_id]);
    console.log(`Stock updated for product ID ${product_id}`);

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.json({ success: false, error: 'Error removing item from cart' });
  }
});
//add item to cart end

//validation chain for profile update start
const profileValidationRules = [
  body('username').trim().escape().notEmpty().withMessage('Name is required.'),
  body('email').isEmail().withMessage('Email is invalid.').normalizeEmail(),
  body('address_line1').trim().escape().notEmpty().withMessage('Address Line 1 is required.'),
  body('address_line2').trim().escape().optional(),
  body('city').trim().escape().notEmpty().withMessage('City is required.'),
  body('state').trim().escape().notEmpty().withMessage('State is required.'),
  body('postal_code').trim().escape().notEmpty().withMessage('Postal Code is required.'),
  body('country').trim().escape().notEmpty().withMessage('Country is required.'),
  body('phone_number').trim().escape().notEmpty().withMessage('Phone number is required.'),
  body('password').optional().isLength({ min: 5 }).withMessage('Password must be at least 5 characters long.')
];
//validation chain for profile update end

//update profile start 
app.post('/update-profile', profileValidationRules, async (req, res) => {
  //console.log("Received profile update request:", req.body);
  try {
    // Check for validation errors first
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    // Ensure the user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    console.log("Received profile update request:", req.body);

    // Extract the form data from the request
    const userId = req.user.id;
    const { username, email, address_line1, address_line2, city, state, postal_code, country, phone_number, password } = req.body;
    
    // Construct the update query with proper column names
    let updateQuery = `
      UPDATE users
      SET username = $1, email = $2, address_line1 = $3, address_line2 = $4, city = $5, state = $6, postal_code = $7, country = $8, phone_number = $9
    `;
    let values = [username, email, address_line1, address_line2, city, state, postal_code, country, phone_number];

    // If password is also being updated, add it to the query and values
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updateQuery += `, password = $10`;
      values.push(hashedPassword);
    }

    values.push(userId); // Add userId as the eleventh value (if password updated) or tenth value (if not)
    updateQuery += ` WHERE id = $` + (password && password.trim() !== '' ? '11' : '10'); // Use $11 if password updated, else use $10

    // Execute the update query
    await pool.query(updateQuery, values);

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
//update profile end

//complete checkout start
app.post('/complete-checkout', async (req, res) => {
  try {
    const user_id = req.user ? req.user.id : null;
    let cartItems = [];
    let subtotalPrice = 0;

    // Fetch cart items for a logged-in user or guest user from the database
    const cartQuery = `
      SELECT c.quantity, p.product_id, p.product_name, p.product_description, p.price
      FROM cart c
      JOIN products p ON c.product_id = p.product_id
      WHERE ${user_id ? 'c.user_id = $1' : 'c.session_id = $1'}
    `;
    const cartResult = await pool.query(cartQuery, [user_id || req.session.id]);
    cartItems = cartResult.rows;
    //console.log("Fetched cart items: ", cartItems);

    // Calculate the subtotal price from cart items
    subtotalPrice = cartItems.reduce((acc, item) => acc + (parseFloat(item.price) * item.quantity), 0);

    // Calculate tax based on subtotal price
    const taxRate = 0.06; // Example tax rate (6%)
    const taxAmount = subtotalPrice * taxRate;
    const totalAmountDue = subtotalPrice + taxAmount;

    console.log("Subtotal price: ", subtotalPrice);
    console.log("Tax amount: ", taxAmount);
    console.log("Total amount due: ", totalAmountDue);

    // Generate a unique invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Start a database transaction
    await pool.query('BEGIN');

    // Insert the order into the 'orders' table with the invoice number
    const orderResult = await pool.query(
      'INSERT INTO orders (user_id, total_price, status, invoice_number, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING order_id',
      [user_id, totalAmountDue, 'Pending', invoiceNumber]
    );
    const orderId = orderResult.rows[0].order_id;

    // Prepare data for the invoice template
    const formData = {
      ...req.body,
      invoiceNumber: invoiceNumber,
      invoiceDate: new Date().toLocaleDateString(),
      cartItems: cartItems,
      subtotalPrice: subtotalPrice.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmountDue: totalAmountDue.toFixed(2)
    };
    console.log("Data being sent to invoice.ejs: ", formData);

    // Clear the cart from the database
    const cartClearQuery = user_id 
      ? 'DELETE FROM cart WHERE user_id = $1' 
      : 'DELETE FROM cart WHERE session_id = $1';
    await pool.query(cartClearQuery, [user_id || req.session.id]);

    // Clear or reset the cart in the session
    req.session.cart = []; // Assuming your cart items are stored in req.session.cart
    await req.session.save(); // Save the session changes

    // Generate the HTML for the invoice from the EJS template
    ejs.renderFile(path.join(__dirname, 'views', 'invoice.ejs'), formData, async (err, html) => {
      if (err) {
        console.error('Error rendering EJS:', err);
        await pool.query('ROLLBACK');
        res.status(500).send("Error processing the checkout.");
      } else {
        // Convert the HTML to a PDF using Puppeteer
        const browser = await puppeteer.launch({ headless:"new"});
        const page = await browser.newPage();
        await page.setContent(html);
        const pdfBuffer = await page.pdf({ format: 'A4' });
        await browser.close();

        // Set up Nodemailer transport
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD,
          },
        });

        // Send email with PDF attached
        const mailOptions = {
          from: process.env.EMAIL_USERNAME,
          to: formData.email,
          cc: process.env.EMAIL_USERNAME, // Send a copy to business email
          subject: 'Your Invoice from Nautical Rarities',
          text: 'Thank you for your purchase! Please find your invoice attached.',
          attachments: [{
            filename: 'invoice.pdf',
            content: pdfBuffer
          }]
        };

        try {
          await transporter.sendMail(mailOptions);
          await pool.query('COMMIT');
          res.redirect('/thankYou');
        } catch (error) {
          console.error('Error sending email:', error);
          await pool.query('ROLLBACK');
          res.status(500).send("Error processing the checkout.");
        }
      }
    });
  } catch (error) {
    // Rollback the transaction on error
    await pool.query('ROLLBACK');
    console.error('Error during checkout process:', error);
    res.status(500).send("Error processing the checkout.");
  }
});

//complete checkout end



//app.listen(3000) //Replace below to get rid of debugging feature. 

app.listen(3000, () => {
    console.log("Server running on port 3000"); //this is for debugging, lets me know the server is working. 
  });