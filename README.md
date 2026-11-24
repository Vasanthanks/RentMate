# RentMate – Peer-to-Peer Rental Platform

**RentMate** is a front-end prototype of a peer-to-peer rental marketplace. Users can rent out items they rarely use (cameras, bicycles, power tools, laptops, electronics, camping gear) and other people can rent them for the days they need them.

> **Problem:** People buy expensive products they only need occasionally, which wastes money.
> **Solution:** A marketplace where owners lend unused items and renters pay only for the days they use them.

## Technologies

Only the following are used:

- HTML5
- CSS3 (custom responsive design, no frameworks)
- Vanilla JavaScript (no libraries)
- Browser **Local Storage** for demo data

No Python, React, Angular, Node.js, PHP, Bootstrap or any backend framework.

## Project files

| File | Purpose |
|------|---------|
| `index.html` | Page structure (navigation, hero, listings, forms, dashboard, history, modal) |
| `style.css` | Complete responsive green and white styling |
| `script.js` | All application logic and Local Storage handling |
| `README.md` | This document |

## How to run

1. Put all four files in the same folder (or unzip `RentMate_Project.zip`).
2. Double-click `index.html` to open it in a modern browser (Chrome, Edge, Firefox, Safari).
3. No installation, server or internet connection is required. Sample product photos load from the internet when online and fall back to category icons when offline.

## Features

| # | Feature | Where / how it works |
|---|---------|----------------------|
| A | **Home page** | Logo, sticky navigation, hero section, "Search Items" button, live counters for total listed items and rental requests |
| B | **Item listing** | "List an Item" form: name, category, daily price, location, image URL, description. The new item appears in the listings immediately |
| C | **Search and filter** | Search by name, filter by category and location, sort by lowest or highest price, "No products found" message |
| D | **Availability checking** | Pick start and end dates. Past dates and end-before-start are blocked, rental days and estimated price are calculated live, and dates overlapping an approved rental are rejected |
| E | **Rental request** | Open any item, enter your name and dates, then get a confirmation. The request is saved in Local Storage |
| F | **Owner approval** | Owner Dashboard lists incoming requests with Pending, Approved, Rejected and Returned tabs. Approve or reject updates the status immediately |
| G | **Rental history** | Table of item, renter, dates, days, total price and current status, plus summary figures |
| H | **Return tracking** | The owner marks an approved rental as **Returned**. It stays in history as a completed rental |

### Extra touches

- Input validation on every form, with inline error messages
- Double-booking protection (a request cannot be approved if it overlaps another approved rental of the same item)
- "Rented now" badge on items currently out on rental
- Empty states, toast notifications, keyboard support (Esc closes the dialog)
- 7 sample items and 3 sample requests are added on first launch
- "Reset demo data" button in the footer

## Demo walkthrough (for presentation)

1. Open `index.html` and note the counters in the hero section.
2. Search for "camera" or filter by category, then sort by price.
3. Click **View & Rent** on an item, enter a name and dates, and watch the days and price update. Try an invalid range, then submit a valid one.
4. Go to **Owner Dashboard**. Approve the new request.
5. Click **Mark as returned** on the approved rental.
6. Open **Rental History** to see all statuses and totals.
7. Use **List an Item** to add your own product and see it appear in the listings.
8. Refresh the page. All data persists. Use "Reset demo data" to start over.

## Important: prototype limitations

This is a **front-end prototype for demonstration only**.

- Data is stored in the browser's **Local Storage**. It lives only on one computer and one browser. There are no real user accounts, no sharing between users and no real payments.
- In this demo a single person plays both renter and owner. The Owner Dashboard shows requests for every item.
- Clearing browser data erases everything.

A real multi-user platform would need a **Java backend** (for example Spring Boot with REST APIs) and a **database** (for example MySQL) to handle authentication, shared listings, per-owner request routing, secure payments, notifications and image storage.

## Possible future work

- User registration and login
- Owner-specific dashboards
- Java backend with a MySQL database
- Image upload and ratings and reviews
- Online payments and security deposits
