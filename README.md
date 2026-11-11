# KeraGo — Premium Ride-Booking Platform Kerala

A modern, premium ride-booking platform built for Kerala service corridors (Kochi, Thiruvananthapuram, Kozhikode, Munnar, Thrissur).

---

## 🌟 Key Highlights & Explicit Requirements Met

### 1. KeraGo Premium Navigation Bar
- **Bilingual Interface**: Seamless instant toggle between **English** and **Malayalam (മലയാളം)**.
- **Brand Identity**: KeraGo monogram and premium automotive typography.
- **Service Pillars**: Direct anchors for Services, Fleet Categories, Kerala Operational Hubs, Fare Guidance, and Authentic Reviews.
- **Guest Gatekeeping**: All interactive booking actions are intercepted with a "Register First" modal for guest users.

### 2. Guest Exploration Gatekeeping & Warning Interception
- **Requirement 1 Satisfied**: The landing state opens as a **Guest Page**. The guest can freely read about services, explore vehicle specifications, view Kerala depots, study fare slabs, and browse FAQs.
- **Warning Popup**: Whenever a guest clicks any interactive or protected action (*"Book Now"*, *"Add Intermediate Stop"*, *"Calculate Route"*, *"Reserve Category"*, *"Submit Review"*), an elegant warning modal appears stating:
  > **"Register First" / "ആദ്യം രജിസ്റ്റർ ചെയ്യുക"**
  > Guest access allows exploration only. In accordance with Kerala transport safety compliance, passengers, drivers, and administrators must be registered manually.

### 3. Strictly Manual Registration (No Random Mock Generators)
- **Requirement 2 Satisfied**: Zero faker/random generator accounts exist.
  - **Passenger Registration**: Full Name, Kerala Mobile Number with simulated real-time 4-digit SMS OTP verification, Email, Kerala District, and Family Emergency Contact.
  - **Driver Onboarding & KYC**: Commercial Driving License No., Vehicle Registration (RC) No., Vehicle Make/Model, Vehicle Category selection, and file attachments (License + RC certificate). Driver applications start as `pending` until verified by the Administrator.
  - **Admin Authorization**: Single sole administrator — Master key: `admin2026`.

### 4. Zero Fabricated Reviews (100% Real Records)
- **Requirement 3 Satisfied**: Displayed average ratings, metrics, and testimonials are computed in real time from genuine records only.
  - Review section displays an empty state explaining the transparency guarantee when 0 reviews exist.
  - Reviews can only be submitted for **verified completed rides** by registered passengers or drivers across 4 distinct criteria: **Punctuality**, **Cleanliness**, **Vehicle Comfort**, and **Overall Service** (1-5 stars) plus written feedback.

### 5. Comprehensive Technical Specification Implementation
- **8 Ride Services**: One-Way City/Inter-City, Round Trips, Hospital & Medical Appointment Assistance (privacy-centric), Safe Night & Bar Driver, Tour Packages & Mountain Sightseeing, Airport & Railway Transfers, Advance Event Bookings, Hourly Driver with reorderable multi-stop waypoints.
- **7 Vehicle Categories**: Eco Bike/Scooter, Electric & Auto-Rickshaw, Green Electric Vehicles (EV), Automatic Compacts, Executive Sedans, Family Premium SUVs, KeraGo Luxury Premium Cars.
- **Itemized Fare Breakdown**: Base flag-down, distance rate slabs, time charges, intermediate stop fees, safety & platform fee, and 5% State GST.
- **Ride-Start OTP**: 4-digit security code generated for every dispatch; drivers must enter it in their terminal before starting the meter.
- **Live Dispatch Simulator**: Simulates driver en route, arrival at pickup, OTP verification, trip progress across Kerala highways, and completion.
- **SEO, AEO & GEO Foundations**: Accurate JSON-LD schema (`Organization`, `FAQPage`), comprehensive Kerala regional hubs, and Answer Engine direct answers.

---

## 🚀 Running the Application

The application is running live on:
```
http://localhost:3000
```

### Manual Scripts
- `npm run dev`: Starts Next.js development server
- `npm run build`: Compiles production build with strict TypeScript and Tailwind CSS
- `npm run start`: Runs production server on port 3000
