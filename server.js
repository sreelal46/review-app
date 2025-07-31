const path = require("path");
const fs = require("fs");
const express = require("express");
const noCache = require("nocache");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;

// File paths
const usersFile = path.join(__dirname, "/data", "users.json");
const reviewsFile = path.join(__dirname, "/data", "reviews.json");

// Middleware setup
app.set("view engine", "hbs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(noCache());

// Session middleware using file store for persistence through server restarts
app.use(
  session({
    secret: "keyboard cat",
    store: new FileStore({}),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }, // 1 hour
  })
);

// Login page route
app.get("/", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("login");
});

// Login verification
app.post("/verify", (req, res) => {
  const { email, password } = req.body;
  const users = fs.existsSync(usersFile)
    ? JSON.parse(fs.readFileSync(usersFile, "utf8"))
    : [];
  const user = users.find((u) => u.email === email && u.password === password);

  if (user) {
    req.session.user = user;
    req.session.save(() => res.redirect("/dashboard"));
  } else {
    res.render("login", { msg: "Invalid email or password" });
  }
});

// Dashboard - protected route
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.render("dashboard", { name: req.session.user.name });
});

// Register new user form
app.get("/new_user", (req, res) => {
  res.render("creating_user");
});

// Handle new user registration
app.post("/new_user", (req, res) => {
  const { email, name, password } = req.body;
  let users = fs.existsSync(usersFile)
    ? JSON.parse(fs.readFileSync(usersFile, "utf8"))
    : [];

  if (users.some((u) => u.email === email)) {
    return res.render("creating_user", { msg: "Email already taken" });
  }

  const newUser = {
    id: users.length > 0 ? users[users.length - 1].id + 1 : 1,
    email,
    name,
    password,
  };

  users.push(newUser);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.redirect("/");
});

// List reviews for logged-in user
app.get("/list", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const allReviews = fs.existsSync(reviewsFile)
    ? JSON.parse(fs.readFileSync(reviewsFile, "utf8"))
    : [];

  const userReviews = allReviews.filter(
    (review) => review.id === req.session.user.id
  );
  res.render("list", { reviews: userReviews });
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.send("Error during logout");
    }
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

// Category-based review form route
app.get("/:category", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const category = req.params.category.toLowerCase();
  const validCategories = ["movies", "anime", "tv-series", "sports"];

  if (validCategories.includes(category)) {
    const display = category.charAt(0).toUpperCase() + category.slice(1);
    return res.render("review", { display });
  }

  res.redirect("/dashboard");
});

// Submit review and render submited_review.hbs
app.post("/review_submited", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  console.log("Session user at submit:", req.session.user); // Debug log

  const { movie_name, review, category } = req.body;
  const display = category.charAt(0).toUpperCase() + category.slice(1);

  const submit = {
    id: req.session.user.id,
    movie_name,
    review,
    display,
    display_lower: display.toLowerCase(),
  };

  const reviews = fs.existsSync(reviewsFile)
    ? JSON.parse(fs.readFileSync(reviewsFile, "utf8"))
    : [];

  reviews.push(submit);
  fs.writeFileSync(reviewsFile, JSON.stringify(reviews, null, 2));

  req.session.save(() => {
    res.render("submited_review", {
      name: req.session.user.name,
      movie_name,
      review,
      display,
      display_lower: display.toLowerCase(),
    });
  });
});

// Start the server
app.listen(PORT, () => console.log(`✅ Server running on port: ${PORT}`));
