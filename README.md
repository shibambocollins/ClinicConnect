# ClinicConnect

**ClinicConnect** is a clinic appointment and patient-management system designed to help patients and healthcare workers manage clinic visits more efficiently. The system aims to reduce long queues, improve appointment scheduling, and make patient information easier for authorized healthcare workers to access.

It is a mobile-first, cross-platform application built with **React Native (Expo)** and **Supabase**, supporting iOS, Android, and Web.

---

## 📚 Academic Context

This project was developed as a group assignment for the **Cape Peninsula University of Technology (CPUT)**.

- **Faculty:** Faculty of Informatics & Design
- **Course:** Diploma in Information & Communication Technology
- **Module:** Project - PRT362S
- **Supervisor:** Mr. Zukile Ndyalivana

**Members:**

|      |
| :--- |
| Athi Sintiya |
| Thinna Barbara Booi |
| Sabelo Ceza |
| Mologadi Mosadinyana Dikgale |
| Andile Pamela Masina |
| Ntsobokwane Collins Shibambo |

---

## ✨ Features

### Patient

- **Registration & Authentication:** Email/password sign-up with OTP verification, and password reset.
- **Appointment Booking:** Search clinics, view available time slots, and book appointments.
- **Medical Records:** View and download personal medical history, visit summaries, and active prescriptions as PDFs.
- **Referrals:** View specialist referral letters issued by doctors.
- **Nearby Clinics:** Locate clinics using geolocation and map views.
- **Emergency Alerts:** One-tap SOS to alert first responders with location data.
- **Notifications:** Receive push and in-app reminders for upcoming appointments.

### Doctor & Nurse

- **Schedules:** View daily scheduled patients and manage queues.
- **Clinical Notes:** Record consultation notes, diagnoses, and vitals.
- **Prescriptions:** Issue digital prescriptions to patients.
- **Referrals:** Create and track specialist referrals.

### Administrator

- **Clinic Management:** Add and update clinic details, operating hours, and services.
- **Staff Management:** Create staff accounts and assign roles.
- **Scheduling:** Configure and manage clinic appointment time slots.

### First Responder

- **Emergency Dashboard:** Receive real-time alerts for nearby emergencies.
- **Status Updates:** Update emergency alert statuses (e.g., dispatched, resolved).

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React Native 0.88 + Expo SDK 58 |
| **Language** | TypeScript v5.x |
| **Navigation** | React Navigation |
| **Backend / DB** | Supabase (Hosted PostgreSQL 15) |
| **Authentication** | Supabase Auth (JWT, Email/Password + OTP) |
| **Storage** | Supabase Storage (PDFs for records/prescriptions) |
| **Realtime** | Supabase Realtime (Postgres LISTEN/NOTIFY) |
| **Notifications** | Expo Notifications + Supabase Push Edge Functions |
| **Testing** | Expo GO |