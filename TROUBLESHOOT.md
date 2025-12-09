### Case:
#### My locators aren't showing in the dropdown list.

#### Option 1
- Anyways, one of the options is to delete your implications-framework folder in your root of the guest repo (basically clearing cache with that action), and also delete your .state-registry.json file inside your implications folder (clearing the registry). Then do the re-scan again



### My tests don't run, or preCheck doesn't find the (different platform) test right before the state
Be sure to add isObserver: true, and mode: "observer" to actual transition
```javascript
on: {
      VIEW_BOOKINGS: {
        target: "booking_created",
        platforms: ["dancer"],
        isObserver: true, // <--- ADD THIS
        mode: "observer", // <--- ADD THIS
        requires: {
          "booking.status": "booking_created"
        },
        actionDetails: {
          description: "Dancer views available bookings",
          platform: "dancer",
          navigationMethod: "navigateToRequestBookings(clubName)",
          navigationFile: "NavigationActionsDancer"
        }
      },
```

and add the parameters on the target status
```javascript
 setup: [
        {
          testFile:
            "tests/implications/bookings/status/BookingCreatedViaClubIsVerified-CREATE_BOOKING-Web-UNIT.spec.js",
          actionName: "bookingCreatedViaClubIsVerified",
          platform: "web",
        },
        {
          testFile:
            "tests/implications/bookings/status/BookingCreatedViaDancerLoggedIn-VIEW_BOOKINGS-Dancer-UNIT.spec.js",
          actionName: "bookingCreatedViaDancerLoggedIn",
          platform: "dancer",
          requires: { "booking.status": "booking_created" }, // For viewing - must exist!
          isObserver: true, // <--- ADD THIS
          mode: "observer", // <--- ADD THIS
        },
      ],
```
