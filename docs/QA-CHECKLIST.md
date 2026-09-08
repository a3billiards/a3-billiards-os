# A3 Billiards OS — QA Test Checklist
**For non-technical testers. Install all 3 APKs fresh before starting.**
- `owner-preview.apk` → Owner App
- `customer-preview.apk` → Customer App
- `admin-preview.apk` → Admin App

---

## How to use this checklist
- ✅ = Works fine
- ❌ = Broken — note what happened
- ⚠️ = Partially works — note the issue
- Write the exact error message you see when something fails

---

# PART 1 — OWNER APP

## A. Login & First-time Setup

| # | What to do | Expected result |
|---|-----------|----------------|
| A1 | Open owner app | A3 logo + language picker + "Owner Panel" + email/password fields + "Continue with Google" button |
| A2 | Try wrong password | Red error: "Invalid email or password" |
| A3 | Try Google Sign-In | Google account picker opens → you get logged in |
| A4 | Login with correct email + password | Goes to passcode setup or home |
| A5 | If asked to set passcode: enter any 6-digit PIN twice | Confirms and goes to home |
| A6 | Change language to Hindi (top of login) | All login text changes to Hindi |
| A7 | Wrong passcode when entering settings | Red error "Invalid passcode" |

---

## B. Home Screen

| # | What to do | Expected result |
|---|-----------|----------------|
| B1 | Look at home screen | Shows: club name, today's revenue, active tables, bookings summary, quick tiles |
| B2 | Tap notification bell (top right) | Opens notification inbox |
| B3 | Tap "Slots" tile | Goes to slots/table grid |
| B4 | Tap "Bookings" tile | Goes to bookings tab |
| B5 | Tap "Financials" tile | Goes to financials |
| B6 | Tap "Complaints" tile | Goes to complaints |
| B7 | Pull down to refresh | Screen refreshes with latest data |
| B8 | Switch language to Hindi in settings | Home screen text shows in Hindi |

---

## C. Slots — Starting a Session (MAIN FEATURE)

| # | What to do | Expected result |
|---|-----------|----------------|
| C1 | Go to Slots tab | Shows table grid with all tables (green = free, color = occupied) |
| C2 | Tap a free table | Options appear: Guest, Registered Customer, Register at Desk, Group |
| C3 | Choose "Guest" | Session starts immediately, timer begins, table turns occupied |
| C4 | Tap an occupied table | Shows current session: time running, bill preview, options |
| C5 | Choose "Registered Customer" → search by name | List of matching customers appears |
| C6 | Search by phone number | Correct customer appears |
| C7 | Choose "Register at Desk" | Form: name, phone, WhatsApp OTP, age, consent |
| C8 | Enter phone for desk registration → tap Send OTP | OTP sent via WhatsApp |
| C9 | Enter correct OTP | Registration completes, session starts |
| C10 | Wrong OTP | Error shown, can retry |
| C11 | Choose "Group" | Group setup screen with primary + add players option |
| C12 | Group: casual mode | All players share bill equally |
| C13 | Group: versus mode | Shows Side A vs Side B, losers pay toggle |
| C14 | Tap QR icon (camera) | Camera opens to scan customer QR |
| C15 | Scan valid customer QR | Customer identified, session starts |
| C16 | Session timer ticking | Timer counts up correctly, bill preview updates |

---

## D. Slots — During Session & Checkout

| # | What to do | Expected result |
|---|-----------|----------------|
| D1 | Tap occupied table → "Add Snacks" | Snack picker opens with available items |
| D2 | Add 2 different snacks | Snacks added, bill updates |
| D3 | Tap "Checkout" on occupied table | Shows full bill: table time + snacks + any discount |
| D4 | Apply discount % at checkout | Bill reduces by that %, shows discount line |
| D5 | Choose payment: Cash | Checkout completes, table goes free |
| D6 | Choose payment: UPI | Same — checkout completes |
| D7 | Choose payment: Credit | Balance saved as credit, table goes free |
| D8 | Checkout shows correct total | Amount = time × rate + snacks − discount |
| D9 | After checkout, table shows as free | Table grid updates immediately |
| D10 | Pull to refresh on slots | Grid refreshes |

---

## E. Snacks Menu Management

| # | What to do | Expected result |
|---|-----------|----------------|
| E1 | Go to Snacks tab | List of current snack items |
| E2 | Add new snack (name + price) | Snack appears in list |
| E3 | Toggle snack availability off | Snack shows as unavailable (grayed out) |
| E4 | Toggle back on | Available again |
| E5 | Edit snack name/price | Changes saved, updated in list |
| E6 | Delete snack (confirm) | Removed from list |
| E7 | Add snack without name | Error: name required |
| E8 | Add snack with price 0 | Error: price must be > 0 |

---

## F. Kitchen Orders

| # | What to do | Expected result |
|---|-----------|----------------|
| F1 | Go to Kitchen tab | Shows order columns: Pending → Preparing → Ready → Served |
| F2 | (After ordering a kitchen snack during a session) New order appears in Pending | Correct item + table shown |
| F3 | Tap advance on Pending order | Moves to Preparing |
| F4 | Tap advance again | Moves to Ready |
| F5 | Tap advance again | Moves to Served |

---

## G. Live Streaming

| # | What to do | Expected result |
|---|-----------|----------------|
| G1 | Go to Live Stream tab | Stream setup screen |
| G2 | Give camera + microphone permission when asked | Permissions granted |
| G3 | Enter a stream title + select a table | Fields filled |
| G4 | Tap Start Stream | Stream begins (camera feed visible) |
| G5 | Viewer count shown | Number updates |
| G6 | Flip camera button | Camera switches front/back |
| G7 | Mute button | Microphone muted/unmuted |
| G8 | Stop stream | Stream ends cleanly |

---

## H. Financials

| # | What to do | Expected result |
|---|-----------|----------------|
| H1 | Go to Financials tab | Revenue chart + date range bar visible |
| H2 | Change date range (e.g. last 7 days) | Chart updates |
| H3 | View payment breakdown | Shows Cash / UPI / Card / Credit amounts |
| H4 | View outstanding credits | List of customers with unpaid credit |
| H5 | Resolve a credit (tap, choose cash) | Credit marked as resolved, removed from list |
| H6 | Tap "GST Report" link | Opens GST report screen |
| H7 | View best performing tables | Table list with revenue |
| H8 | Date range > 90 days | Warning shown |

---

## I. Complaints

| # | What to do | Expected result |
|---|-----------|----------------|
| I1 | Go to Complaints tab | Shows active + retracted complaints list |
| I2 | File new complaint: search customer by phone | Customer found |
| I3 | Select complaint type (e.g. "Runaway without payment") | Type selected |
| I4 | Enter complaint details + confirm | Complaint filed, appears in list |
| I5 | Retract a complaint with reason | Status changes to retracted |
| I6 | Filed complaint for unknown phone | Error shown |

---

## J. Bookings Management

| # | What to do | Expected result |
|---|-----------|----------------|
| J1 | Go to Bookings tab | Pending / Upcoming / History segments |
| J2 | See a pending booking | Customer name, date, time, table type shown |
| J3 | Approve booking → assign table | Booking moves to Upcoming |
| J4 | Reject booking with reason | Booking moves to History with "Rejected" status |
| J5 | Start session from an upcoming booking (within 15 min of start time) | Session starts, booking marked started |
| J6 | Cancel a booking as club | Booking cancelled |
| J7 | Search bookings | Results filter correctly |

---

## K. Documents

| # | What to do | Expected result |
|---|-----------|----------------|
| K1 | Go to Documents tab | List of uploaded documents (or empty) |
| K2 | Add a document (trade license, etc.) | Choose file → document appears in list |
| K3 | Tap document to view | Opens PDF/image viewer |
| K4 | Delete document (confirm) | Removed from list |

---

## L. Settings — Club Profile

| # | What to do | Expected result |
|---|-----------|----------------|
| L1 | Go to Settings → Club Profile section (tap to expand) | Club profile fields visible |
| L2 | Edit club description → Save | Saved, message "Saved" appears |
| L3 | Toggle "Show club in customer search" | Toggles on/off |
| L4 | Add a club photo from gallery | Photo appears in gallery row |
| L5 | Remove a photo | Photo removed |
| L6 | Add/remove amenities (AC, WiFi, etc.) | Chips toggle on/off |
| L7 | Add custom amenity → Save | Custom chip appears |
| L8 | Set operating hours → Save | Hours saved |
| L9 | Move location pin on map → Save Location | New pin position saved |
| L10 | All Settings labels show in Hindi when Hindi selected | No English strings remain |

---

## L2. Settings — Tables

| # | What to do | Expected result |
|---|-----------|----------------|
| M1 | Expand Tables section | List of all tables |
| M2 | Add new table (label + type + floor) | Table appears in list and slot grid |
| M3 | Rename a table | New name shown |
| M4 | Disable a table | Shows "Disabled" badge, hidden from slot grid |
| M5 | Re-enable a table | Back in slot grid |
| M6 | Try to disable a table with active session | Error: end session first |

---

## L3. Settings — Online Booking

| # | What to do | Expected result |
|---|-----------|----------------|
| N1 | Enable online bookings | Toggle on |
| N2 | Set max advance days (e.g. 7) | Saved |
| N3 | Set min advance minutes (e.g. 60) | Saved |
| N4 | Enable "Require booking coupon" + enter coupon code | Saved |
| N5 | Set slot durations (e.g. 60 min, 90 min) | Chips selected, saved |
| N6 | Set bookable table types | Correct types shown |
| N7 | Set bookable hours | Saved |
| N8 | Try to enable bookings without required setup | Warning shown |

---

## L4. Settings — GST

| # | What to do | Expected result |
|---|-----------|----------------|
| O1 | Expand GST Settings | All GST fields visible in local language |
| O2 | Toggle GST registered on/off | Toggles correctly |
| O3 | Enter GSTIN | Saved |
| O4 | Choose Intrastate / Interstate | Selection saved |
| O5 | Enter table GST % and snack GST % | Saved |
| O6 | Enter invalid GST % (e.g. 150) | Error: must be 0–100 |

---

## L5. Settings — Staff Roles

| # | What to do | Expected result |
|---|-----------|----------------|
| P1 | Add new staff role (name + select tabs + table access) | Role created |
| P2 | Add Chef role (special button) | Kitchen-only role created |
| P3 | Activate staff role | Owner enters passcode → staff view shows limited tabs |
| P4 | Exit staff mode (enter passcode) | Full owner tabs restored |
| P5 | Staff in non-permitted tab | "Access Denied" screen |
| P6 | Delete role | Removed from list |

---

## L6. Settings — Security

| # | What to do | Expected result |
|---|-----------|----------------|
| Q1 | Change account password | Old + new + confirm → "Saved" |
| Q2 | Change settings passcode | Old + new 6-digit → updated |
| Q3 | Download club members data | Download + share option |
| Q4 | Request data export (your own data) | Email confirmation shown |
| Q5 | Sign out | Returns to login |

---

## M. Language Switching (Owner)

| # | What to do | Expected result |
|---|-----------|----------------|
| R1 | Settings → Language → Select Hindi | All Settings section labels, buttons, alerts in Hindi |
| R2 | Switch to Telugu or Kannada | Same — everything translates |
| R3 | Switch back to English | Returns to English |
| R4 | Check: Online Booking labels in Hindi | "ऑनलाइन बुकिंग स्वीकार करें" etc. |
| R5 | Check: GST labels in Hindi | "GST सेटिंग्स" section fully in Hindi |

---

---

# PART 2 — CUSTOMER APP

## AA. Login & Registration

| # | What to do | Expected result |
|---|-----------|----------------|
| AA1 | Open customer app | Login screen: phone number input + Send OTP |
| AA2 | Enter your phone → Send OTP | OTP arrives via WhatsApp |
| AA3 | Enter correct OTP | Logs in / goes to register if new |
| AA4 | Enter wrong OTP | Error: "Wrong OTP" |
| AA5 | Send OTP too many times | Rate limit error shown |
| AA6 | Register new account: name, phone, age | OTP sent, completes registration |
| AA7 | Age under 18 | Error: must be 18+ |
| AA8 | Change language on login screen | Login text changes |
| AA9 | Set password (from profile) | Password set, can use password login |
| AA10 | Login with phone + password | Works |

---

## BB. Home Screen

| # | What to do | Expected result |
|---|-----------|----------------|
| BB1 | See home screen | Greeting with name, notification bell, quick links |
| BB2 | Active complaint visible | Alert card shown with club name + type |
| BB3 | Upcoming booking shown | Hero card with club, date, countdown timer |
| BB4 | Tap upcoming booking | Opens booking detail |
| BB5 | Tap "Discover" quick link | Goes to discover |
| BB6 | Tap "Live" quick link | Goes to live streams |

---

## CC. Discover & Club Booking (CRITICAL PATH)

| # | What to do | Expected result |
|---|-----------|----------------|
| CC1 | Go to Discover tab | Search bar + club cards |
| CC2 | Search for club by name | Matching clubs appear |
| CC3 | Allow location permission | "Near me" clubs sorted by distance |
| CC4 | Tap a club card | Club profile: photos, hours, rates, amenities |
| CC5 | Tap "Book a table" | Opens booking wizard |
| CC6 | Step 1: Select table type (e.g. Snooker, Pool) | Table type selected, next step appears |
| CC7 | Step 2: Select specific table from list | Table selected |
| CC8 | Step 3: Select a date from the strip | Date highlighted, next step |
| CC9 | **Date strip must NOT crash after selecting table** | Dates show, no app crash ✅ |
| CC10 | Step 4: Select duration (60 min, 90 min, etc.) | Duration selected |
| CC11 | Step 5: Select available time slot | Time selected |
| CC12 | Step 6: Review — shows club, table, date, time, cost estimate | All details correct |
| CC13 | If coupon required: enter coupon code | Coupon accepted |
| CC14 | Add optional notes | Notes field works |
| CC15 | Tap Confirm | Booking submitted, redirected to Bookings tab |
| CC16 | Booking appears in Upcoming | Status: Pending Approval |
| CC17 | Club not accepting online bookings | Clear message shown |
| CC18 | No available time slots | "No slots available" message |
| CC19 | Slot becomes unavailable on review | Alert, redirects back to time selection |

---

## DD. My Bookings

| # | What to do | Expected result |
|---|-----------|----------------|
| DD1 | Go to Bookings tab | Upcoming + History segments |
| DD2 | See pending booking | Status chip: Pending Approval |
| DD3 | See confirmed booking | Status: Confirmed, table assigned visible |
| DD4 | Cancel a booking | Cancellation confirmation, moves to History |
| DD5 | Try cancelling too close to start time | Warning about late cancellation |
| DD6 | Tap booking for details | Full detail: club, date, time, table, cost, status |
| DD7 | Rejected booking shows reason | Rejection reason visible in detail |

---

## EE. Session History

| # | What to do | Expected result |
|---|-----------|----------------|
| EE1 | Go to History tab | List of past play sessions |
| EE2 | Tap to expand a session | Shows: date, table, duration, bill breakdown |
| EE3 | Bill shows table time + snacks + discount | All line items correct |
| EE4 | Credit session (unpaid) | Shows "Credit" payment method |

---

## FF. Live Streaming (Watch)

| # | What to do | Expected result |
|---|-----------|----------------|
| FF1 | Go to Live tab | Shows active streams (or "no streams" if none) |
| FF2 | Tap a live stream | Video player opens, stream loads |
| FF3 | Tap close/back | Returns to live list |

---

## GG. Profile

| # | What to do | Expected result |
|---|-----------|----------------|
| GG1 | Go to Profile tab | Name, phone, email, member since, QR code |
| GG2 | Customer QR code visible | QR for desk check-in at club |
| GG3 | Edit name | Updated, saved |
| GG4 | Edit age | Updated |
| GG5 | Add email | Saved (if no email yet) |
| GG6 | Change language | App language changes |
| GG7 | Change password | Old + new + confirm → saved |
| GG8 | Request my data export | Confirmation message |
| GG9 | Delete account: requires typing phrase | Account deletion requested |
| GG10 | Sign out | Returns to login |
| GG11 | Language change — Discover + Booking screens also change | No English leftover |

---

## HH. Notifications (Customer)

| # | What to do | Expected result |
|---|-----------|----------------|
| HH1 | Tap bell icon | Inbox opens |
| HH2 | Admin sent a broadcast | Notification appears in inbox |
| HH3 | Tap notification to read | Marked as read |

---

## HH. Edge Cases (Customer)

| # | Scenario | Expected result |
|---|---------|----------------|
| EC1 | Login with frozen account | "Account blocked" screen, can only sign out |
| EC2 | No internet | Appropriate offline/loading error |
| EC3 | Booking for club with no tables set | "No bookable types" message |
| EC4 | Select table, go to date step → no dates available | "No bookable dates" message — NOT a crash |
| EC5 | Book same slot another customer already took | Error on submission, clear message |

---

---

# PART 3 — ADMIN APP

## BA. Login & MFA

| # | What to do | Expected result |
|---|-----------|----------------|
| BA1 | Open admin app | Login: email + password |
| BA2 | Login with admin credentials | MFA code sent automatically |
| BA3 | Enter correct 6-digit MFA code | Goes to dashboard |
| BA4 | Enter wrong MFA code | Error, can retry |
| BA5 | MFA code expires: tap Resend (after 60s) | New code sent |
| BA6 | Non-admin account login | "Access denied" — signed out |

---

## BB. Dashboard

| # | What to do | Expected result |
|---|-----------|----------------|
| BB1 | See dashboard | Stat cards: users, clubs, sessions, complaints, bookings, revenue |
| BB2 | Active sessions shows live dot | Live indicator visible |
| BB3 | Pull to refresh | Stats update |
| BB4 | Tap stat card → Users | Filtered user list opens |
| BB5 | Tap Complaints | Opens complaints list |

---

## BC. Users

| # | What to do | Expected result |
|---|-----------|----------------|
| BC1 | Go to Users tab | Searchable list with role badges |
| BC2 | Search by name | Correct users found |
| BC3 | Filter: Owners | Only owner accounts shown |
| BC4 | Filter: Customers | Only customers shown |
| BC5 | Tap a user | Full profile opens |
| BC6 | View owner profile | Shows club, subscription, active sessions |
| BC7 | Freeze a user | Confirmed, status changes |
| BC8 | Unfreeze a user | Status changes back |
| BC9 | Reset user password | Email sent confirmation |
| BC10 | Edit user name/email | Changes saved |
| BC11 | Export all users (CSV) | Download + share |
| BC12 | Export single user data | Same |
| BC13 | Promote customer to admin (type CONFIRM) | Role changes |
| BC14 | Demote admin to owner | Role changes |
| BC15 | Force-end active session (with reason) | Session ended |
| BC16 | View user's active complaints | Listed in profile |

---

## BD. Complaints (Admin)

| # | What to do | Expected result |
|---|-----------|----------------|
| BD1 | Go to Complaints tab | Platform-wide complaints list |
| BD2 | Filter by: Active only | Only active complaints shown |
| BD3 | Filter by: Complaint type | Filtered results |
| BD4 | Filter by: Club | Club-specific complaints |
| BD5 | Expand a complaint | Full details: customer, club, description, date |
| BD6 | Dismiss with reason | Status changes to Dismissed |
| BD7 | Tap user name in complaint | Goes to user profile |

---

## BE. Live Moderation

| # | What to do | Expected result |
|---|-----------|----------------|
| BE1 | Go to Live Moderation tab | Shows all active streams across clubs |
| BE2 | Stream count shown on tab badge | Number is correct |
| BE3 | Force-end a stream (with reason) | Stream stopped |
| BE4 | No active streams | Empty state shown |

---

## BF. Audit Log

| # | What to do | Expected result |
|---|-----------|----------------|
| BF1 | Go to Audit tab | List of all admin actions |
| BF2 | Actions include: freeze, password reset, dismiss complaint, session end | Correct action types shown |
| BF3 | Load more (scroll down) | More entries load |
| BF4 | Pull to refresh | Refreshes |

---

## BG. Notifications (Admin)

| # | What to do | Expected result |
|---|-----------|----------------|
| BG1 | Go to Notifications tab → Compose | Title + body fields + target selector |
| BG2 | Target: All users → Preview count | Shows recipient count |
| BG3 | Target: All owners | Owner count shown |
| BG4 | Target: Specific users → search | User picker with search |
| BG5 | Send broadcast | Confirmation, appears in History |
| BG6 | Go to History tab | Past broadcasts listed |
| BG7 | Expand a broadcast | Delivery stats shown |
| BG8 | Customer receives push notification | Notification arrives on phone |

---

---

# PART 4 — CROSS-APP FLOWS

## CA. Owner ↔ Customer Booking Flow (Full Round-Trip)

| # | Steps | Expected result |
|---|-------|----------------|
| CA1 | Customer books a table at a club (CC6–CC15) | Booking request sent |
| CA2 | Owner sees booking in Pending tab | Customer name + time visible |
| CA3 | Owner approves + assigns table | Customer booking status → Confirmed |
| CA4 | Customer sees "Confirmed" status in their Bookings tab | ✅ |
| CA5 | Owner starts session from booking at correct time | Session links to booking |
| CA6 | Session checkout by owner | Customer session appears in their History |
| CA7 | Owner rejects booking with reason | Customer sees "Rejected" + reason |
| CA8 | Customer cancels own booking | Owner no longer sees it in Upcoming |

---

## CB. Complaint Cross-App Flow

| # | Steps | Expected result |
|---|-------|----------------|
| CB1 | Owner files complaint against customer (phone search) | Complaint stored |
| CB2 | Customer logs into customer app | Alert banner visible on Home |
| CB3 | Owner tries to start session for that customer | Complaint warning shown |
| CB4 | Admin sees complaint in Complaints tab | Listed platform-wide |
| CB5 | Admin dismisses complaint | Status changes to Dismissed |
| CB6 | Customer banner disappears on next refresh | ✅ |

---

## CC. Push Notifications Flow

| # | Steps | Expected result |
|---|-------|----------------|
| CC1 | Admin sends broadcast to all customers | Customers receive push notification |
| CC2 | Owner approves booking | Customer gets "Booking Confirmed" push |
| CC3 | Booking approaching (1 hour before) | Customer gets reminder push |
| CC4 | Open notification → lands on correct screen | Deep link works |

---

## CD. Language Change Coverage

| # | What to do | Expected result |
|---|-----------|----------------|
| CD1 | Owner: change to Hindi → check all Settings sections | EVERY label in Hindi (no English left) |
| CD2 | Customer: change to Hindi → check Discover, Book, Profile | Fully translated |
| CD3 | Change back to English | Fully restored |
| CD4 | Change to Arabic | App displays Arabic text |
| CD5 | Telugu / Kannada / Tamil / Malayalam | Works for each language |

---

## CE. Reset Password / Account Flows (Web Links)

| # | What to do | Expected result |
|---|-----------|----------------|
| CE1 | Tap "Forgot password" in customer app | Reset email sent |
| CE2 | Click link in email | Opens password reset page (NOT 404) |
| CE3 | Enter new password | Password changed |
| CE4 | Customer requests account deletion | Confirmation email received |
| CE5 | Click cancel deletion link in email | Cancellation confirmed (NOT 404) |

---

---

# PART 5 — EDGE CASES TO SPECIFICALLY TEST

| # | Scenario | Which app | Expected |
|---|----------|-----------|---------|
| EE1 | No internet connection | All | Loading spinner or offline error, not crash |
| EE2 | Start session on table that another device just started | Owner | Error: table already in use |
| EE3 | Try to start more than 1 active session on same table | Owner | Lock prevents it |
| EE4 | Checkout when snacks were added | Owner | Snacks appear in bill breakdown |
| EE5 | Discount > 100% | Owner | Error shown |
| EE6 | Group session with 1 player only | Owner | Error: need at least 2 for versus |
| EE7 | Book online with expired coupon code | Customer | Clear error |
| EE8 | Book online for a club that turned off bookings | Customer | "Not accepting bookings" message |
| EE9 | Select table → date strip shows — no crash | Customer | Dates visible, no crash ✅ |
| EE10 | Date with no available slots | Customer | "No slots" message |
| EE11 | Two customers try to book same slot | Customer | Second gets error on confirm |
| EE12 | Owner with expired subscription | Owner | Full-screen freeze lock |
| EE13 | Staff without financials tab permission | Owner | Tab access denied screen |
| EE14 | Staff enters wrong passcode to enter owner mode | Owner | Error, retry |
| EE15 | Customer with frozen account | Customer | Account blocked screen |
| EE16 | Admin without completed MFA | Admin | Stuck on MFA screen, can't access dashboard |
| EE17 | Non-admin logging into admin app | Admin | Signed out, access denied |
| EE18 | Large data export (many sessions) | Owner/Admin | File shared/downloaded without crash |
| EE19 | Upload unsupported document type | Owner | Error or graceful rejection |
| EE20 | Very long club description (500 chars) | Owner | Counter shows 500/500, saves correctly |
| EE21 | Keyboard covers input field (forms/login) | All | Input stays visible, keyboard doesn't hide it |
| EE22 | Set password with weak password | Customer/Owner | Strength bar shows "Weak" in red |
| EE23 | Set password with strong password | Customer/Owner | Strength bar shows "Strong" in green |
| EE24 | Book online: approval deadline passes | Customer | Booking auto-cancelled, notification sent |
| EE25 | Force-close app mid-session (session still running) | Owner | Session still running on reopen |

---

## How to report a bug

Write down:
1. Which app (Owner / Customer / Admin)
2. Which step number (e.g. CC9)
3. What you expected
4. What actually happened (exact error text or describe the crash)
5. Screenshot if possible

---

*Checklist generated: July 2, 2026 — A3 Billiards OS Phase 2*
