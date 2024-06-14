import express from 'express';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './model/user.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import stripePackage from 'stripe';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import nodemailer from 'nodemailer';
import uniqid from 'uniqid';
import UserTransaction from './model/UserTransaction.js'; 
import Blog from './model/blog.js'

dotenv.config();


const stripe = stripePackage(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(cookieParser());



// Route to render the form
app.get('/', (req, res) => {
    res.render('flightInput');
});

// Function to get access token
async function getAccessToken() {
    const tokenResponse = await axios.post('https://test.api.amadeus.com/v1/security/oauth2/token', new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AMADEUS_CLIENT_ID,
        client_secret: process.env.AMADEUS_CLIENT_SECRET
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    return tokenResponse.data.access_token;
}

// Function to get IATA code
async function getIATACode(city, accessToken) {
    const response = await axios.get('https://test.api.amadeus.com/v1/reference-data/locations', {
        params: {
            keyword: city,
            subType: 'CITY,AIRPORT'
        },
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (response.data && response.data.data && response.data.data.length > 0) {
        return response.data.data[0].iataCode;
    } else {
        throw new Error(`IATA code not found for city: ${city}`);
    }
}

// Route to handle form submission
app.post('/flight-offers', async (req, res) => {
    const { origin, destination, departureDate, returnDate, adults, children, travelClass, maxPrice } = req.body;

    console.log("the departure date is" + departureDate);

    try {
        const accessToken = await getAccessToken();
        console.log(accessToken);
        const originCode = await getIATACode(origin, accessToken);
        const destinationCode = await getIATACode(destination, accessToken);

        // Fetch flight offers
        const response = await axios.get('https://test.api.amadeus.com/v2/shopping/flight-offers', {
            params: {
                originLocationCode: originCode,
                destinationLocationCode: destinationCode,
                departureDate: departureDate,
                returnDate: returnDate,
                adults: adults,
                children: children,
                travelClass: travelClass,
                maxPrice: maxPrice
            },
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const offers = response.data.data;
        res.render('flightOffers', { offers });

    } catch (error) {
        console.error('Error fetching data from Amadeus API:', error);
        res.status(500).send('Error fetching data from Amadeus API');
    }
});

app.get('/hotel-input',(req,res)=>{
    res.render('hotel_input');
});

app.get('/blog', async (req, res) => {
    try {
        let blogs = await Blog.find();
        let popularBlogs = await Blog.find().sort({ _id: -1 }).limit(5);

        // Default to empty arrays if none found
        blogs = blogs || [];
        popularBlogs = popularBlogs || [];

        res.render('blogs', { blogs: blogs, popular_blogs: popularBlogs });
    } catch (error) {
        console.error("Error fetching blogs:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/blog', async (req, res) => {
    const { title, content } = req.body;
    try {
        const newBlog = new Blog({
            title,
            content,
        });
        await newBlog.save();
        res.redirect('/blog');
    } catch (err) {
        console.log(err);
        res.status(500).send('Server Error');
    }
});


app.get('/login', (req, res) => {
    res.render('login_form', { errorMessage: null });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const user=await User.findOne({username:email}).lean();

    if(!user)
    {
        return res.json({status:'error',error:'Invalid username or password1'});
    }

    if(await bcrypt.compare(password,user.password))
    {
        const token=jwt.sign({id:user._id,username:user.username},process.env.JWT_SECRET)
        res.cookie('token', token, { httpOnly: true });
        return res.json({ status: 'ok' });
    }

    return res.json({status:'error',error:'Invalid username or password2'});
});


function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    console.log(token)
    if (!token) {
        return res.status(401).json({ status: 'error', error: 'Not authenticated' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ status: 'error', error: 'Invalid token' });
        }

        req.user = decoded; // Attach the decoded payload to the request object
        next();
    });
}

// Route to check if user is logged in
app.get('/check-log-in', authenticateToken, (req, res) => {
    res.json({ status: 'ok', user: req.user });
});

app.get('/register', (req, res) => {
    res.render('register_form', { errorMessage: null });
});

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    console.log(email);
    console.log(password);

    try {
        const encryptedPassword = await bcrypt.hash(password, 10);
        const response = await User.create({
            username: email,
            password: encryptedPassword
        });
        console.log('User created successfully:', response);
        res.status(200).json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        console.log(error);
        if (error.code === 11000) {
            res.status(400).json({ success: false, message: 'Email already exists' });
        } else {
            res.status(500).json({ success: false, message: 'An error occurred during registration' });
        }
    }
});

app.post('/logout', (req, res) => {
    console.log("token cleared")
    res.clearCookie('token');
    res.json({ status: 'ok' });
});

app.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userTransaction = await UserTransaction.findOne({ username: req.user.username });
        const transactions = userTransaction ? userTransaction.transactions : [];
        res.render('profile_page', { transactions ,userName:req.user.username});
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).send('Error fetching transactions');
    }
});

function authenticateJWT(req, res, next) {
    const token = req.cookies.token;
  
    if (token) {
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.redirect('/login');
        } else {
          req.user = decoded;
          next();
        }
      });
    } else {
      res.redirect('/login');
    }
  }
  
  // Define payment route
  app.post('/payment',authenticateJWT, async (req, res) => {
    const paymentData = req.body;
    console.log('Received payment data:', paymentData);
    const price=Number(paymentData.price);
    const departure=paymentData.departure;
    const arrival=paymentData.arrival;
    const id=paymentData.id;
    const flightNumber=paymentData.flightNumber;
    const airline=paymentData.airline;
    const amount = Math.round(price * 1.08 * 100);
    // Process the payment data (e.g., interact with a payment gateway)
    try{
        const session=await stripe.checkout.sessions.create({
            payment_method_types:['card'],
            mode:'payment',
            line_items:[
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Flight Booking',
                            description: `Flight ${flightNumber} from ${departure} to ${arrival} of ${airline}`,
                        },
                        unit_amount: amount, // Amount in cents ($303.00)
                    },
                    quantity: 1,
                },
            ],
            success_url:`${process.env.SERVER_URL}/success?flightNumber=${flightNumber}&departure=${departure}&arrival=${arrival}&airline=${airline}&price=${price}`,

            cancel_url:`${process.env.SERVER_URL}`
        })
        res.json({url:session.url})
    }
    catch(e){
        res.status(500).json({error: e.message})
    }
});

app.post('/payment-hotel', async (req, res) => {
    const paymentData = req.body;
    console.log('Received payment data:', paymentData);
    const price=Number(paymentData.price);
    const hotelName=paymentData.hotelName;
    const checkInDate=paymentData.checkInDate;
    const checkOutDate=paymentData.checkOutDate;
    const hotelId=paymentData.hotelId;
    const currency=paymentData.currency;
    const amountindol=Math.round(price * 1.08);
    const amountincents = Math.round(price * 100);
    // Process the payment data (e.g., interact with a payment gateway)
    try{
        const session=await stripe.checkout.sessions.create({
            payment_method_types:['card'],
            mode:'payment',
            line_items:[
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'HOTEL Booking',
                            description: `${hotelName} with id ${hotelId} booked from ${checkInDate} to ${checkOutDate}`,
                        },
                        unit_amount: amountincents, // Amount in cents ($303.00)
                    },
                    quantity: 1,
                },
            ],
            success_url:`${process.env.SERVER_URL}/success-hotel?hotelName=${hotelName}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&hotelId=${hotelId}&price=${price}`,

            cancel_url:`${process.env.SERVER_URL}`
        })
        res.json({url:session.url})
    }
    catch(e){
        res.status(500).json({error: e.message})
    }
});

app.get('/success',authenticateToken,async (req, res) => {
    const { flightNumber, departure, arrival, airline, price} = req.query;

    // Generate PDF Invoice
    const invoiceDir = path.join(__dirname, 'public', 'invoice');
    if (!fs.existsSync(invoiceDir)) {
        fs.mkdirSync(invoiceDir, { recursive: true });
    }
    let d=new Date();
    let date=d.toLocaleString();
    // Generate PDF Invoice
    const invoicePath = path.join(invoiceDir, `invoice-${departure}to${arrival}${flightNumber}.pdf`);
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(invoicePath));
    doc.fontSize(25).text('Flight Invoice', { align: 'center' });
    doc.fontSize(18).text(`Flight Number: ${flightNumber}`);
    doc.text(`Departure: ${departure}`);
    doc.text(`Arrival: ${arrival}`);
    doc.text(`Airline: ${airline}`);
    doc.text(`Price: EUR${price}`);
    doc.text(`Transaction Date: ${date}`);
    doc.end();


    try {
        const userTransaction = await UserTransaction.findOne({ username: req.user.username });
        const transaction = {
            transactionDate: new Date(),
            transactionAmount: price,
            invoicePdf: invoicePath
        };

        if (userTransaction) {
            userTransaction.transactions.push(transaction);
            await userTransaction.save();
            console.log('Transaction updated:', userTransaction);
        } else {
            const newUserTransaction = new UserTransaction({
                username: req.user.username,
                transactions: [transaction]
            });
            await newUserTransaction.save();
            console.log('Transaction saved:', newUserTransaction);
        }
    } catch (error) {
        console.error('Error saving transaction:', error);
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // Use `true` for port 465, `false` for all other ports
        auth: {
          user: 'kieran.harris27@ethereal.email',
          pass: 'AcbYjvv2ndGsuxnfPA'
        },
});
    console.log(req.user);
    const mailOptions = {
        from: '"Sky Travels 🏝️" <SkyTravels@service.email>', // sender address
        to: req.user.username, // list of receivers
        subject: 'Your Flight Invoice',
        text: 'Thank you for your booking. Please find attached your invoice.',
        attachments: [
            {
                filename: `invoice-${departure}to${arrival}${flightNumber}.pdf`,
                path: invoicePath
            }
        ]
    };
    console.log(invoicePath);
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error sending email');
        }
        console.log('Email sent: ' + info.response);

        // Render EJS view
        res.render('Success', { flightNumber, departure, arrival, airline, price, invoicePath });
    });
});


app.get('/success-hotel',authenticateJWT, async (req, res) => {
    /*hotelName=${hotelName}&checkInDate=${checkInDate}&checkOutDate=${checkOutDate}&hotelId=${hotelId}&price=${price}*/
    const { hotelName, checkInDate, checkOutDate, hotelId, price} = req.query;

    // Generate PDF Invoice
    const invoiceDir = path.join(__dirname, 'public', 'invoice');
    if (!fs.existsSync(invoiceDir)) {
        fs.mkdirSync(invoiceDir, { recursive: true });
    }
    let d=new Date();
    let date=d.toLocaleString();
    // Generate PDF Invoice
    let fileName=`invoice-${hotelName}booked${hotelId}${uniqid()}.pdf`;
    const invoicePath = path.join(invoiceDir, fileName);
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(invoicePath));
    doc.fontSize(25).text('HOTEL Invoice', { align: 'center' });
    doc.fontSize(18).text(`HOTEL NAME: ${hotelName}`);
    doc.text(`Check in Date: ${checkInDate}`);
    doc.text(`Check Out Date: ${checkOutDate}`);
    doc.text(`Hotel id: ${hotelId}`);
    doc.text(`Price: EUR${price}`);
    doc.text(`Transaction Date: ${date}`);
    doc.end();

    try {
        const userTransaction = await UserTransaction.findOne({ username: req.user.username });
        const transaction = {
            transactionDate: new Date(),
            transactionAmount: price,
            invoicePdf: invoicePath
        };

        if (userTransaction) {
            userTransaction.transactions.push(transaction);
            await userTransaction.save();
            console.log('Transaction updated:', userTransaction);
        } else {
            const newUserTransaction = new UserTransaction({
                username: req.user.username,
                transactions: [transaction]
            });
            await newUserTransaction.save();
            console.log('Transaction saved:', newUserTransaction);
        }
    } catch (error) {
        console.error('Error saving transaction:', error);
    }

    const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // Use `true` for port 465, `false` for all other ports
        auth: {
          user: 'kieran.harris27@ethereal.email',
          pass: 'AcbYjvv2ndGsuxnfPA'
        },
});
    console.log(req.user);
    const mailOptions = {
        from: '"Sky Travels 🏝️" <SkyTravels@service.email>', // sender address
        to: req.user.username, // list of receivers
        subject: 'Your Flight Invoice',
        text: 'Thank you for your booking. Please find attached your invoice.',
        attachments: [
            {
                filename: fileName,
                path: invoicePath
            }
        ]
    };
    console.log(invoicePath);
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Error sending email');
        }
        console.log('Email sent: ' + info.response);

        // Render EJS view
        res.render('success_hotel', { hotelName, checkInDate, checkOutDate, hotelId, price, invoicePath });
    });
});


// Route to download the invoice
app.get('/download-invoice', (req, res) => {
    const invoicePath = req.query.invoicePath;
    console.log(invoicePath);
    res.download(invoicePath, err => {
        if (err) {
            console.error(err);
            res.status(500).send('Error downloading the file');
        }
    });
});


app.post('/hotel-offers', async (req, res) => {
    let { city, checkInDate, checkOutDate } = req.body;
    city = city.toLowerCase();
    console.log(city, checkInDate, checkOutDate);

    try {
        const accessToken = await getAccessToken(); // Assuming you have a function to get the access token
        const cityCode = await getIATACode(city, accessToken);

        // Fetch hotel offers using Amadeus Hotel List API
        const response = await axios.get('https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city', {
            params: {
                cityCode: cityCode
            },
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const offers = response.data.data;
        res.render('hotel_offers', { offers});

    } catch (error) {
        console.error('Error fetching hotel offers:', error);
        res.status(500).send('Error fetching hotel offers');
    }
});





app.post('/available_booking_options', async (req, res) => {
    let { hotelId,hotelName, checkInDate, checkOutDate, adults, rooms } = req.body;

    console.log(hotelId)
    /*if(hotelName=="LYTTON")
        hotelId="HNPARKGU"*/

    console.log(hotelId)

    try {
        const accessToken = await getAccessToken();

        const response = await axios.get('https://test.api.amadeus.com/v3/shopping/hotel-offers', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            params: {
                hotelIds: hotelId,
                checkInDate,
                checkOutDate,
                adults,
                rooms,
                currency:'EUR'
            }
        });

        const data = response.data.data;
        /*if(hotelId=="HNPARKGU")
            data[0].hotel.name="LYTTON"*/
        const dictionaries=response.data.dictionaries;

        if (data.length > 0) {
            res.render('hotel_details', { data ,dictionaries});
        } else {
            res.render('confirmation', { hotelName: hotelName, checkInDate, checkOutDate });
        }

    } catch (error) {
        res.render('confirmation', { hotelName: hotelName, checkInDate, checkOutDate });
    }
});


app.get('/faq', (req, res) => {
    res.render('faq');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

