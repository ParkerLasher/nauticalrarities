# nauticalrarities
Mock E-Commerce Website

Overview

Nautical Rarities is an e-commerce platform specializing in selling rare stamps and comic books. The website allows users to browse products, add items to their cart, and complete purchases. Users can also create accounts, log in, update profiles, and view their order history.


Architecture

Front-End:
HTML, CSS
JavaScript (for dynamic interactions and AJAX requests)

Back-End:
Server: Node.js with Express framework
Database: PostgreSQL
Authentication: Passport.js with bcrypt for password hashing
Session Management: express-session with connect-pg-simple for PostgreSQL session store
Email Service: Nodemailer for sending invoices
Third-Party Services:
Font Awesome (for icons)
Puppeteer (for generating PDF invoices)


Key Features

User Authentication:
Register, login, and logout functionality.
Passport.js local strategy for authentication.

Product Catalogue:
Categories for Stamps and Comics.
Product listings fetched from the PostgreSQL database.

Shopping Cart:
Add and remove items from the cart.
Session-based cart management for guests.
Cart migration upon user login.

Checkout Process:
Form to collect shipping and payment information.
Invoice generation using ejs template and Puppeteer.
Email invoice to the user using Nodemailer.

User Profile and Order History:
Profile update functionality.
Display user's past orders and current cart.

Responsive Design:
CSS styling for different device sizes.


Database Schema

Users: Stores user information, including encrypted passwords.

Products: Contains product details like name, description, price, and stock quantity.

Cart: Links products with users/sessions and stores quantity.

Orders: Records completed orders, linked to users.


Security Considerations

Passwords are hashed using bcrypt.
Input validation and error handling to prevent SQL injection and other common web attacks.


Future Enhancements

Integration with a payment gateway for processing payments.
Expanding product categories and inventory management features.
