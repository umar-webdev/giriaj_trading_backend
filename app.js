const express = require('express');
const bodyParser = require('body-parser');
const { check, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// MongoDB connection
const dbUri = 'mongodb+srv://umar:0000@cluster0.k5o4qzt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

if (!mongoose.connection.readyState) {
  mongoose.connect(dbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = mongoose.connection;
  db.on('error', console.error.bind(console, 'MongoDB connection error:'));
  db.once('open', () => {
    console.log('Connected to MongoDB');
  });
}

// MongoDB schema
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  companyName: String,
  gstNumber: String,
  password: String,
});

const UserModel = mongoose.model('User', userSchema);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'girirajtrading329@gmail.com',
    pass: 'mmzc rdah atxk zira',
  },
});

const validateSignupFields = [
  check('name').isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  check('email').isEmail().withMessage('Invalid email address'),
  check('companyName').isLength({ min: 3 }).withMessage('Company name must be at least 3 characters'),
  check('gstNumber').isLength({ min: 3 }).withMessage('GST number must be at least 3 characters'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  check('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
];

app.post('/signup', validateSignupFields, async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, companyName, gstNumber, password } = req.body;

  const existingUser = await UserModel.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const newUser = new UserModel({ name, email, companyName, gstNumber, password });
  await newUser.save();

  const token = jwt.sign({ userId: newUser._id, userEmail: newUser.email }, 'nsmedia', { expiresIn: '1h' });
  res.status(201).json({ message: 'Signup successful', token });
});

app.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await UserModel.findOne({ email, password });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, userEmail: user.email }, 'nsmedia', { expiresIn: '1h' });
    res.json({ message: 'Signin successful', token });
  } catch (error) {
    console.error('Error during signin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/sendQuotes', authenticateToken, async (req, res) => {
  const { userEmail, products } = req.body;

  if (products && Array.isArray(products)) {
    const recipients = [userEmail, 'girirajtrading329@gmail.com']; // Add additional email address here
   
    const mailOptions = {
      from: 'girirajtrading329@gmail.com',
      to: recipients.join(', '), // Combine recipients into a comma-separated string
      subject: 'Your Final Quotes',
      html: generateInvoiceHTML(products),
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({ message: 'Quotes sent successfully' });
    } catch (error) {
      console.error("Error sending mail", error);
      res.status(500).json({ error: 'Error sending email' });
    }
  } else {
    res.status(400).json({ error: 'Invalid quotes data' });
  }
});

function generateInvoiceHTML(products) {
  let html = `
    <h1>Invoice</h1>
    <table border="1">
      <thead>
        <tr>
          <th>Product</th>
          <th>Quantity</th>
          <th>Rate</th>
          <th>Total Rate</th>
        </tr>
      </thead>
      <tbody>
  `;

  products.forEach(product => {
    // Check for NaN and undefined values and handle them appropriately
    if (!isNaN(product.quantity) && !isNaN(product.rate) && product.name) {
      html += `
        <tr>
          <td>${product.name}</td>
          <td>${product.quantity}</td>
          <td>$${product.rate}</td>
          <td>$${(product.quantity * parseFloat(product.rate)).toFixed(2)}</td>
        </tr>
      `;
    }
  });

  html += `
      </tbody>
    </table>
  `;

  return html;
}

function authenticateToken(req, res, next) {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  jwt.verify(token, 'nsmedia', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
    req.user = user;
    next();
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;