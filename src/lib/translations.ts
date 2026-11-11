import { Language } from '../types';

export const translations = {
  en: {
    brandName: "DriveC",
    brandTagline: "Premium Driver Bookings & Self-Drive Car Rentals • Kochi, Kerala",
    nav: {
      services: "Services",
      bookDriver: "Book a Driver",
      rentCar: "Self-Drive Rental",
      fleet: "Fleet & Categories",
      serviceAreas: "Kochi Service Hubs",
      fareGuide: "Transparent Pricing",
      reviews: "Verified Reviews",
      userPortal: "Customer Portal",
      driverPortal: "Driver Terminal",
      ownerPortal: "Owner Terminal",
      adminPortal: "Command Center",
      guestMode: "Guest Mode",
      signIn: "Sign In",
      register: "Register",
      signOut: "Sign Out",
      role: "Role",
    },
    guestBanner: {
      title: "DriveC Guest Exploration Mode Active",
      subtitle: "Browse driver booking rates, self-drive owner listings, and verified Kochi service hubs. Mobile verification required before confirming trips or vehicle handovers.",
      cta: "Register with OTP",
    },
    guestWarningModal: {
      title: "DriveC Authentication Required",
      badge: "Account Verification Needed",
      message: "Please register or sign in using your mobile number to book a professional driver, reserve a self-drive vehicle, or access provider terminals. Kerala transport regulations require verified passenger and provider accounts.",
      registerBtn: "Register with Mobile OTP",
      loginBtn: "Already have an account? Sign In",
      stayGuest: "Continue Exploring as Guest",
    },
    hero: {
      badge: "DriveC Kochi • God's Own Country",
      title: "Professional Driver For Your Car or Self-Drive Rentals Across Kerala",
      subtitle: "Need a qualified driver to pilot your car, or want to rent an approved owner-listed vehicle for self-drive? DriveC delivers transparent pricing, zero surge, and authenticated security.",
      exploreBtn: "Explore Vehicles & Fares",
      bookBtn: "Book Driver / Rent Car",
      features: [
        "Qualified Drivers For Your Car",
        "Approved Owner Self-Drive Fleet",
        "Ride-Start OTP & Handover Checklists",
        "Transparent Fixed Platform Commission"
      ]
    },
    booking: {
      title: "Plan Your Journey or Rental",
      subtitle: "Itemised transparent quotes based on approved Kerala distance slabs & daily rental rates",
      tabDriver: "Book a Driver",
      tabRental: "Rent a Self-Drive Car",
      serviceSelect: "Select Driving Service",
      vehicleSelect: "Select Vehicle Category",
      yourVehicleDetails: "Your Car Specification",
      carModelPlaceholder: "Car Model (e.g. Baleno, City, Seltos, Fortuner)",
      transmissionLabel: "Transmission",
      manual: "Manual",
      automatic: "Automatic",
      fuelLabel: "Fuel Type",
      petrol: "Petrol",
      diesel: "Diesel",
      ev: "Electric (EV)",
      cng: "CNG / Hybrid",
      pickupLabel: "Pickup",
      dropLabel: "Drop off",
      addStop: "+ Add intermediate stop",
      removeStop: "Remove",
      dateLabel: "Date",
      timeLabel: "Time",
      roundTrip: "Round Trip (Return journey included)",
      returnDate: "Return Date",
      returnTime: "Return Time",
      hoursLabel: "Driver Duty Duration (Hours)",
      rentalDaysLabel: "Rental Duration (Days)",
      promoLabel: "Promo Code",
      promoPlaceholder: "Enter code (e.g. DRIVECFIRST)",
      applyPromo: "Apply",
      flightTrainLabel: "Flight / Train No. (Syncs with Cochin Airport delays)",
      hospitalNotes: "Hospital Assistance Notes (Wheelchair trunk space, clinic escort)",
      tourNotes: "Kerala Sightseeing Route (Munnar, Athirappilly, Alleppey)",
      passengerType: "Booking for myself or another person?",
      myself: "Myself",
      otherPassenger: "Another Person",
      otherName: "Passenger Full Name",
      otherPhone: "Passenger Mobile Number",
      calcRoute: "Calculate Transparent Quote",
      fareSummary: "Itemised Quote Breakdown",
      baseFare: "Base Tariff",
      distanceKm: "Estimated Distance",
      distanceCharge: "Distance Rate",
      timeCharge: "Time & Waiting",
      stopCharges: "Intermediate Stops",
      taxGst: "State GST (5%)",
      platformFee: "Platform & Safety Fee",
      discount: "Promotional Discount",
      securityDeposit: "Advance Amount",
      totalEstimate: "Total Amount Payable",
      paymentLabel: "Payment Method",
      cash: "Cash on Duty",
      upi: "UPI (GPay / PhonePe / QR)",
      card: "Credit / Debit Card",
      confirmBooking: "Confirm DriveC Booking",
      otpNote: "A 4-digit Ride-Start OTP will be generated. Provide it to the driver only when duty commences.",
    },
    services: {
      'one-way': {
        title: "City & Intercity Point-to-Point",
        desc: "Professional driver steers your car across Kochi or interdistrict Kerala highways."
      },
      'round-trip': {
        title: "Round Trips & Outstation",
        desc: "Return journeys with dedicated driver standby and discounted return slabs."
      },
      'hospital-assistance': {
        title: "Hospital & Medical Transit",
        desc: "Gentle, compassionate driver for patient checkups, Aster Medcity / Amrita clinic escorts."
      },
      'bar-pickup': {
        title: "Night Safe Concierge",
        desc: "Responsible sober driver drives your personal car home safely late night."
      },
      'tour-package': {
        title: "Kerala High Range Tours",
        desc: "Experienced ghat road driver for Munnar, Vagamon, Wayanad tea estate journeys."
      },
      'airport-transfer': {
        title: "Cochin Airport (COK) Express",
        desc: "Terminal 3 Nedumbassery express transit with flight delay tracking."
      },
      'advance-event': {
        title: "Weddings & Corporate Driver",
        desc: "Immaculately uniformed driver for business executives and family celebrations."
      },
      'hourly-driver': {
        title: "Dedicated Hourly Driver",
        desc: "Hire a professional driver by the hour (2h to 14h) for errands and multiple stops."
      },
      'self-drive': {
        title: "Self-Drive Car Rental",
        desc: "Rent approved owner vehicles with verified documents and clear handover checklists."
      }
    },
    categories: {
      hatchback: {
        name: "Hatchback",
        desc: "Agile, fuel-efficient city cars (Swift, Baleno, i20). Easy to navigate Kerala towns.",
        seats: 4,
        luggage: "2 Medium Bags"
      },
      sedan: {
        name: "Executive Sedan",
        desc: "Comfortable sedans (City, Ciaz, Verna). Smooth highway cruising and luggage trunk.",
        seats: 5,
        luggage: "3 Large Bags"
      },
      suv: {
        name: "SUV / MUV",
        desc: "Spacious SUVs (Creta, Seltos, Innova). High ground clearance for Kerala monsoon & hills.",
        seats: 7,
        luggage: "4 Large Bags"
      },
      premium: {
        name: "Luxury / Premium",
        desc: "Flagship luxury vehicles (Innova Crysta, Fortuner, BMW, Merc). VIP executive comfort.",
        seats: 7,
        luggage: "5 Large Bags"
      }
    },
    reviews: {
      title: "Verified Customer & Driver Reviews",
      subtitle: "100% authentic ratings from passengers after completed journeys and vehicle handovers.",
      writeReview: "Rate Your Trip",
      overall: "Overall Experience",
      punctuality: "Punctuality & Timeliness",
      cleanliness: "Vehicle Condition",
      comfort: "Smooth Driving Conduct",
      emptyState: "No fabricated reviews. Reviews appear only after passengers complete trips with verified DriveC drivers or self-drive rentals."
    },
    auth: {
      fullName: "Full Name",
      phone: "Mobile Number",
      email: "Email Address",
      city: "City / District",
      emergency: "Emergency Contact (Optional)",
      license: "Commercial Driving License / Badge",
      rc: "Experience & Credentials",
      selectCat: "Permitted Vehicle Categories",
      submitDriver: "Submit DriveC Driver Application",
      manualNotice: "DriveC enforces verified KYC verification. Drivers and Vehicle Owners are approved by administrators before receiving bookings."
    }
  },
  ml: {
    brandName: "ഡ്രൈവ്സി (DriveC)",
    brandTagline: "പ്രൊഫഷണൽ ഡ്രൈവർ ബുക്കിംഗും സെൽഫ് ഡ്രൈവ് കാർ റെന്റലും • കൊച്ചി, കേരളം",
    nav: {
      services: "സേവനങ്ങൾ",
      bookDriver: "ഡ്രൈവറെ ബുക്ക് ചെയ്യുക",
      rentCar: "സെൽഫ് ഡ്രൈവ് കാർ",
      fleet: "വാഹന വിഭാഗങ്ങൾ",
      serviceAreas: "കൊച്ചി കേന്ദ്രങ്ങൾ",
      fareGuide: "സുതാര്യ നിരക്കുകൾ",
      reviews: "അവലോകനങ്ങൾ",
      userPortal: "ഉപഭോക്തൃ പോർട്ടൽ",
      driverPortal: "ഡ്രൈവർ ടെർമിനൽ",
      ownerPortal: "ഓണർ ടെർമിനൽ",
      adminPortal: "കമാൻഡ് സെന്റർ",
      guestMode: "ഗസ്റ്റ് മോഡ്",
      signIn: "ലോഗിൻ",
      register: "രജിസ്റ്റർ ചെയ്യുക",
      signOut: "സൈൻ ഔട്ട്",
      role: "റോൾ",
    },
    guestBanner: {
      title: "ഡ്രൈവ്സി ഗസ്റ്റ് മോഡ് സജീവം",
      subtitle: "നിങ്ങൾ ഗസ്റ്റായി ബ്രൗസ് ചെയ്യുന്നു. ഡ്രൈവർ നിരക്കുകളും സെൽഫ് ഡ്രൈവ് കാറുകളും കാണാം. ബുക്കിംഗ് പൂർത്തിയാക്കാൻ മൊബൈൽ ഒടിപി വഴി രജിസ്റ്റർ ചെയ്യുക.",
      cta: "രജിസ്റ്റർ ചെയ്യുക",
    },
    guestWarningModal: {
      title: "രജിസ്ട്രേഷൻ ആവശ്യമാണ്",
      badge: "അക്കൗണ്ട് ആവശ്യമാണ്",
      message: "നിങ്ങളുടെ കാറിനായി ഡ്രൈവറെ ബുക്ക് ചെയ്യാനും സെൽഫ് ഡ്രൈവ് വാഹനം വാടകയ്‌ക്കെടുക്കാനും ദയവായി ലോഗിൻ ചെയ്യുക അല്ലെങ്കിൽ രജിസ്റ്റർ ചെയ്യുക.",
      registerBtn: "മൊബൈൽ ഒടിപി വഴി രജിസ്റ്റർ",
      loginBtn: "അക്കൗണ്ട് ഉണ്ടോ? ലോഗിൻ ചെയ്യുക",
      stayGuest: "ഗസ്റ്റായി തുടരുക",
    },
    hero: {
      badge: "ഡ്രൈവ്സി കൊച്ചി • കേരളം",
      title: "നിങ്ങളുടെ കാറിന് വിദഗ്ദ്ധ ഡ്രൈവർ അല്ലെങ്കിൽ സെൽഫ് ഡ്രൈവ് റെന്റൽ",
      subtitle: "നിങ്ങളുടെ സ്വന്തം കാർ ഓടിക്കാൻ പരിചയസമ്പന്നരായ ഡ്രൈവർമാരെ നേടൂ, അല്ലെങ്കിൽ അംഗീകൃത ഉടമസ്ഥരുടെ വാഹനങ്ങൾ സെൽഫ് ഡ്രൈവിനായി വാടകയ്‌ക്കെടുക്കൂ. സുതാര്യ നിരക്കുകൾ.",
      exploreBtn: "നിരക്കുകൾ അറിയുക",
      bookBtn: "ഇപ്പോൾ ബുക്ക് ചെയ്യുക",
      features: [
        "നിങ്ങളുടെ കാർ ഓടിക്കാൻ വിദഗ്ദ്ധ ഡ്രൈവർമാർ",
        "അംഗീകൃത സെൽഫ് ഡ്രൈവ് കാറുകൾ",
        "റൈഡ്-സ്റ്റാർട്ട് ഒടിപിയും ഹാൻഡ്ഓവർ ചെക്ക്‌ലിസ്റ്റും",
        "സുതാര്യമായ നിരക്ക്"
      ]
    },
    booking: {
      title: "യാത്ര അല്ലെങ്കിൽ വാടക മുൻകൂട്ടി പ്ലാൻ ചെയ്യൂ",
      subtitle: "കേരള മോട്ടോർ വാഹന നിയമങ്ങൾക്കനുസൃതമായ ന്യായമായ നിരക്കുകൾ",
      tabDriver: "ഡ്രൈവറെ ബുക്ക് ചെയ്യുക",
      tabRental: "സെൽഫ് ഡ്രൈവ് കാർ വാടകയ്‌ക്കെടുക്കുക",
      serviceSelect: "സേവനം തിരഞ്ഞെടുക്കുക",
      vehicleSelect: "വാഹന വിഭാഗം",
      yourVehicleDetails: "നിങ്ങളുടെ കാറിന്റെ വിവരങ്ങൾ",
      carModelPlaceholder: "കാർ മോഡൽ (ഉദാ: സ്വിഫ്റ്റ്, സിറ്റി, ക്രെറ്റ)",
      transmissionLabel: "ഗിയർ ട്രാൻസ്മിഷൻ",
      manual: "മാനുവൽ",
      automatic: "ഓട്ടോമാറ്റിക്",
      fuelLabel: "ഇന്ധനം",
      petrol: "പെട്രോൾ",
      diesel: "ഡീസൽ",
      ev: "ഇലക്ട്രിക് (EV)",
      cng: "സിഎൻജി / ഹൈബ്രിഡ്",
      pickupLabel: "പിക്കപ്പ് സ്ഥലം (കൊച്ചി)",
      dropLabel: "ഡെസ്റ്റിനേഷൻ സ്ഥലം",
      addStop: "+ ഇടവേള സ്റ്റോപ്പ് ചേർക്കുക",
      removeStop: "നീക്കം ചെയ്യുക",
      dateLabel: "തീയതി",
      timeLabel: "സമയം",
      roundTrip: "റൗണ്ട് ട്രിപ്പ് (മടക്കയാത്ര ഉൾപ്പെടെ)",
      returnDate: "മടക്ക തീയതി",
      returnTime: "മടക്ക സമയം",
      hoursLabel: "ഡ്രൈവർ സമയം (മണിക്കൂറുകൾ)",
      rentalDaysLabel: "വാടക കാലാവധി (ദിവസങ്ങൾ)",
      promoLabel: "പ്രൊമോ കോഡ്",
      promoPlaceholder: "കോഡ് നൽകുക (ഉദാ: DRIVECFIRST)",
      applyPromo: "പ്രയോഗിക്കുക",
      flightTrainLabel: "ഫ്ലൈറ്റ് / ട്രെയിൻ നമ്പർ (ഓപ്ഷണൽ)",
      hospitalNotes: "ആശുപത്രി സഹായ വിവരങ്ങൾ",
      tourNotes: "ടൂർ വിവരങ്ങൾ (മൂന്നാർ, അതിരപ്പിള്ളി, ആലപ്പുഴ)",
      passengerType: "യാത്രക്കാരൻ ആര്?",
      myself: "ഞാൻ തന്നെ",
      otherPassenger: "മറ്റൊരു വ്യക്തി",
      otherName: "യാത്രക്കാരന്റെ പേര്",
      otherPhone: "മൊബൈൽ നമ്പർ",
      calcRoute: "നിരക്ക് കണക്കാക്കുക",
      fareSummary: "നിരക്ക് വിവരങ്ങൾ",
      baseFare: "അടിസ്ഥാന നിരക്ക്",
      distanceKm: "ദൂരം",
      distanceCharge: "ദൂര നിരക്ക്",
      timeCharge: "സമയ നിരക്ക്",
      stopCharges: "സ്റ്റോപ്പ് ചാർജ്",
      taxGst: "ജിഎസ്ടി (5%)",
      platformFee: "പ്ലാറ്റ്‌ഫോം & സുരക്ഷാ ഫീസ്",
      discount: "പ്രമോഷണൽ ഇളവ്",
      securityDeposit: "അഡ്വാൻസ് തുക (Advance Amount)",
      totalEstimate: "ആകെ തുക",
      paymentLabel: "പേയ്‌മെന്റ് രീതി",
      cash: "ഡ്രൈവർക്ക് പണം നൽകുക",
      upi: "യുപിഐ (GPay / PhonePe)",
      card: "കാർഡ് പേയ്‌മെന്റ്",
      confirmBooking: "ഡ്രൈവ്സി ബുക്കിംഗ് ഉറപ്പാക്കുക",
      otpNote: "4 അക്ക റൈഡ്-സ്റ്റാർട്ട് ഒടിപി ഡ്രൈവർ യാത്ര ആരംഭിക്കുമ്പോൾ മാത്രം നൽകുക.",
    },
    services: {
      'one-way': {
        title: "വൺ-വേ സിറ്റി & ഇന്റർസിറ്റി",
        desc: "നിങ്ങളുടെ കാർ സുരക്ഷിതമായി ലക്ഷ്യസ്ഥാനത്ത് എത്തിക്കുന്നു."
      },
      'round-trip': {
        title: "റൗണ്ട് ട്രിപ്പ് & ദീർഘദൂര യാത്ര",
        desc: "നിങ്ങൾക്കൊപ്പം ഡ്രൈവർ കാത്തുനിൽക്കുന്നു, കുറഞ്ഞ നിരക്ക്."
      },
      'hospital-assistance': {
        title: "ആശുപത്രി സഹായ യാത്രകൾ",
        desc: "ആസ്റ്റർ, അമൃത ആശുപത്രികളിലേക്ക് പ്രത്യേക പരിചരണത്തോടെയുള്ള ഡ്രൈവർ സേവനം."
      },
      'bar-pickup': {
        title: "രാത്രി സുരക്ഷിത യാത്ര",
        desc: "രാത്രി നിങ്ങളുടെ കാർ ഉത്തരവാദിത്തമുള്ള ഡ്രൈവർ സുരക്ഷിതമായി വീട്ടിലെത്തിക്കുന്നു."
      },
      'tour-package': {
        title: "കേരള ഹൈറേഞ്ച് ടൂർ യാത്രകൾ",
        desc: "മൂന്നാർ, വാഗമൺ മലമ്പാതകളിൽ പരിചയസമ്പന്നരായ ഡ്രൈവർമാർ."
      },
      'airport-transfer': {
        title: "കൊച്ചി വിമാനത്താവള (COK) സർവീസ്",
        desc: "നെടുമ്പാശ്ശേരി എയർപോർട്ടിലേക്ക് ഫ്ലൈറ്റ് ട്രാക്കിംഗോടെ കൃത്യസമയത്ത് യാത്ര."
      },
      'advance-event': {
        title: "വിവാഹ & കോർപ്പറേറ്റ് ഡ്രൈവർ",
        desc: "വിവാഹങ്ങൾക്കും പരിപാടികൾക്കും പ്രൊഫഷണൽ ഡ്രൈവർമാർ."
      },
      'hourly-driver': {
        title: "മണിക്കൂർ അടിസ്ഥാനത്തിൽ ഡ്രൈവർ",
        desc: "2 മുതൽ 14 മണിക്കൂർ വരെ നിങ്ങളുടെ ആവശ്യങ്ങൾക്ക് ഡ്രൈവറെ വാടകയ്‌ക്കെടുക്കാം."
      },
      'self-drive': {
        title: "സെൽഫ് ഡ്രൈവ് കാർ റെന്റൽ",
        desc: "പരിശോധിച്ചുറപ്പിച്ച ഉടമസ്ഥരുടെ കാറുകൾ സെൽഫ് ഡ്രൈവിനായി സുരക്ഷിതമായി എടുക്കാം."
      }
    },
    categories: {
      hatchback: {
        name: "ഹാച്ച്ബാക്ക്",
        desc: "സ്വിഫ്റ്റ്, ബലേനോ, i20 തുടങ്ങിയ ചെറിയ കാറുകൾ. കേരളത്തിലെ റോഡുകൾക്ക് അനുയോജ്യം.",
        seats: 4,
        luggage: "2 ബാഗുകൾ"
      },
      sedan: {
        name: "എക്സിക്യൂട്ടീവ് സെഡാൻ",
        desc: "ഹോണ്ട സിറ്റി, സിയാസ്, വെർണ തുടങ്ങിയ ആഡംബര സെഡാനുകൾ.",
        seats: 5,
        luggage: "3 വലിയ ബാഗുകൾ"
      },
      suv: {
        name: "എസ്‌യുവി / എംയുവി",
        desc: "ക്രെറ്റ, സെൽറ്റോസ്, ഇന്നോവ. ഹൈ ഗ്രൗണ്ട് ക്ലിയറൻസ്, മലയോര യാത്രകൾക്ക് ഉത്തമം.",
        seats: 7,
        luggage: "4 വലിയ ബാഗുകൾ"
      },
      premium: {
        name: "ലക്ഷ്വറി / പ്രീമിയം",
        desc: "ഇന്നോവ ക്രിസ്റ്റ, ഫോർച്യൂണർ, ബിഎംഡബ്ല്യു തുടങ്ങിയ പ്രീമിയം വാഹനങ്ങൾ.",
        seats: 7,
        luggage: "5 വലിയ ബാഗുകൾ"
      }
    },
    reviews: {
      title: "സാക്ഷ്യപ്പെടുത്തിയ അവലോകനങ്ങൾ",
      subtitle: "പൂർത്തിയായ യാത്രകൾക്ക് ശേഷമുള്ള ഉപഭോക്താക്കളുടെ യഥാർത്ഥ റേറ്റിംഗുകൾ.",
      writeReview: "റിവ്യൂ നൽകുക",
      overall: "മൊത്തത്തിലുള്ള അനുഭവം",
      punctuality: "കൃത്യനിഷ്ഠ",
      cleanliness: "വാഹന ശുചിത്വം",
      comfort: "സുരക്ഷിത ഡ്രൈവിംഗ്",
      emptyState: "യാത്രകൾ പൂർത്തിയായ ശേഷം മാത്രമേ റിവ്യൂകൾ ഇവിടെ ദൃശ്യമാകൂ."
    },
    auth: {
      fullName: "മുഴുവൻ പേര്",
      phone: "മൊബൈൽ നമ്പർ",
      email: "ഇമെയിൽ വിലാസം",
      city: "നഗരം / ജില്ല",
      emergency: "അടിയന്തിര നമ്പർ (ഓപ്ഷണൽ)",
      license: "ഡ്രൈവിംഗ് ലൈസൻസ് / ബാഡ്ജ് നമ്പർ",
      rc: "പ്രവർത്തിപരിചയം വിവരങ്ങൾ",
      selectCat: "ഓടിക്കാൻ സാധിക്കുന്ന വാഹന വിഭാഗങ്ങൾ",
      submitDriver: "ഡ്രൈവർ അപേക്ഷ സമർപ്പിക്കുക",
      manualNotice: "ഡ്രൈവ്സി കർശനമായ കെവൈസി പരിശോധന ഉറപ്പാക്കുന്നു. ഡ്രൈവർമാരെയും വാഹന ഉടമകളെയും അഡ്മിനിസ്ട്രേറ്റർമാർ പരിശോധിച്ചുറപ്പിച്ച ശേഷം മാത്രമേ സജീവമാക്കൂ."
    }
  }
};

export const KERALA_SERVICE_AREAS = [
  {
    id: "hub-cok",
    name: "Cochin International Airport (COK) & Nedumbassery",
    nameMl: "കൊച്ചി അന്താരാഷ്ട്ര വിമാനത്താവളം (COK) & നെടുമ്പാശ്ശേരി",
    zone: "North Kochi Gateway",
    hub: "Nedumbassery Depot",
    popularDestinations: ["Terminal 3 International", "Terminal 1 Domestic", "Aluva Metro", "Angamaly Bypass"],
    activeFleetCount: 42,
    baseAvailability: true,
    descriptionEn: "24x7 Driver dispatch and self-drive car pickup/return depot at Nedumbassery with flight sync.",
    descriptionMl: "നെടുമ്പാശ്ശേരിയിൽ 24 മണിക്കൂറും ഡ്രൈവർ ലഭ്യതയും സെൽഫ് ഡ്രൈവ് കാർ ഹാൻഡ്ഓവറും."
  },
  {
    id: "hub-infopark",
    name: "Kakkanad Infopark & SmartCity Corridor",
    nameMl: "കാക്കനാട് ഇൻഫോപാർക്ക് & സ്മാർട്ട് സിറ്റി",
    zone: "IT & Tech Express",
    hub: "Kakkanad Cyber Gateway",
    popularDestinations: ["Infopark Phase 1 & 2", "Rajagiri Valley", "Civil Station", "Seaport-Airport Road"],
    activeFleetCount: 38,
    baseAvailability: true,
    descriptionEn: "Corporate driver duty, shift commutes, and self-drive car rentals for tech professionals.",
    descriptionMl: "ഐടി ജീവനക്കാർക്കായി കോർപ്പറേറ്റ് ഡ്രൈവർമാരും സെൽഫ് ഡ്രൈവ് വാടക കാറുകളും."
  },
  {
    id: "hub-ernakulam",
    name: "MG Road, Panampilly Nagar & Marine Drive",
    nameMl: "എംജി റോഡ്, പനമ്പിള്ളി നഗർ & മറൈൻ ഡ്രൈവ്",
    zone: "Central Business District",
    hub: "Ernakulam South Station Hub",
    popularDestinations: ["Marine Drive Walkway", "Panampilly Boutique Zone", "Ernakulam Junction (ERS)", "High Court Jetty"],
    activeFleetCount: 50,
    baseAvailability: true,
    descriptionEn: "Central Kochi driver standby for shopping, medical checkups, and evening dinner concierge.",
    descriptionMl: "കൊച്ചി നഗരഹൃദയത്തിൽ ഷോപ്പിംഗിനും ആശുപത്രി യാത്രകൾക്കും ഡ്രൈവർ സേവനം."
  },
  {
    id: "hub-edappally",
    name: "Edappally Toll & Lulu International Corridor",
    nameMl: "ഇടപ്പള്ളി ടോൾ & ലുലു മാൾ ഇടനാഴി",
    zone: "High-Traffic Junction Hub",
    hub: "Edappally Metro Depot",
    popularDestinations: ["Lulu Mall Grand Entry", "Amrita Hospital AIMS", "NH 66 / NH 544 Interchange", "Palarivattom"],
    activeFleetCount: 35,
    baseAvailability: true,
    descriptionEn: "North-South transit intersection hub with immediate driver dispatches and rental handovers.",
    descriptionMl: "ദേശീയപാത ജംഗ്ഷനുകളിൽ ഉടനടി ഡ്രൈവർ ഡിസ്പാച്ചും കാർ ഹാൻഡ്ഓവറും."
  },
  {
    id: "hub-fortkochi",
    name: "Fort Kochi, Mattancherry & Heritage Tourist Zone",
    nameMl: "ഫോർട്ട് കൊച്ചി, മട്ടാഞ്ചേരി & പൈതൃക മേഖല",
    zone: "Heritage & Tourism",
    hub: "Fort Kochi Customs Jetty",
    popularDestinations: ["Chinese Fishing Nets", "Jew Town & Synagogue", "Kochi-Muziris Biennale Hub", "Vypin Ferry"],
    activeFleetCount: 24,
    baseAvailability: true,
    descriptionEn: "Heritage tour drivers and leisure self-drive vehicles for scenic coastal exploration.",
    descriptionMl: "ടൂറിസ്റ്റുകൾക്കായി വിനോദസഞ്ചാര ഡ്രൈവർമാരും തീരദേശ സെൽഫ് ഡ്രൈവ് കാറുകളും."
  }
];
