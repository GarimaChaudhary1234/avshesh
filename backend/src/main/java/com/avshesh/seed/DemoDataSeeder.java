package com.avshesh.seed;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.avshesh.common.ApiException;
import com.avshesh.listing.ListingMode;
import com.avshesh.listing.ListingService;
import com.avshesh.listing.ListingService.CreateRequest;
import com.avshesh.listing.PickupInfoProvider;
import com.avshesh.pickup.PaymentConfirmationService;
import com.avshesh.pickup.PaymentMode;
import com.avshesh.pickup.PickupQueryService.PickupView;
import com.avshesh.pickup.PickupScheduler;
import com.avshesh.pickup.StopCompletionService;
import com.avshesh.municipal.ActivityLog;
import com.avshesh.municipal.CollectionPointService;
import com.avshesh.municipal.CollectionPointService.PointInput;
import com.avshesh.municipal.MunicipalRequestService;
import com.avshesh.municipal.MunicipalRequestService.NewRequest;
import com.avshesh.municipal.MunicipalStaffService;
import com.avshesh.municipal.MunicipalStaffService.StaffInput;
import com.avshesh.ratecard.RateCardService;
import com.avshesh.ratecard.RateCardService.RateCardView;
import com.avshesh.ratecard.RateCardService.RateItem;
import com.avshesh.user.AccountService;
import com.avshesh.user.CollectorBusinessProfile;
import com.avshesh.user.CollectorProfileUpdater;
import com.avshesh.user.CollectorVerifier;
import com.avshesh.user.Role;
import com.avshesh.user.UserAccount;
import com.avshesh.user.VehicleType;
import com.avshesh.user.VerificationStatus;
import com.avshesh.ward.WardDirectory;
import com.avshesh.ward.WardInfo;
import com.avshesh.ward.WardLocator;

/**
 * Fills an empty local database with a demo mohalla inside a real ward of Bhubaneswar: households, two
 * verified collectors, one collector waiting for approval, ward officers, staff, drop-off points and a
 * half-full pool. The people, shops and drop-off points are made up; only the wards are real.
 */
@Component
@Profile("local")
@Order(1)
public class DemoDataSeeder implements ApplicationRunner {

    /** Every seeded account logs in with this password (local demo only). */
    public static final String DEMO_PASSWORD = "demo1234";

    /** Centre of a geohash cell inside ward 15, so every demo point below lies in that ward. */
    private static final double BASE_LAT = AccountService.DEFAULT_LAT;
    private static final double BASE_LNG = AccountService.DEFAULT_LNG;

    private final AccountService accounts;
    private final RateCardService rateCards;
    private final ListingService listings;
    private final CollectorProfileUpdater profiles;
    private final CollectorVerifier verifier;
    private final CollectionPointService points;
    private final MunicipalRequestService municipalRequests;
    private final MunicipalStaffService staff;
    private final WardLocator wardLocator;
    private final WardDirectory wards;
    private final PickupScheduler scheduler;
    private final StopCompletionService completion;
    private final PaymentConfirmationService payments;
    private final PickupInfoProvider pickupInfo;
    private final ActivityLog activity;

    public DemoDataSeeder(AccountService accounts, RateCardService rateCards, ListingService listings,
                          CollectorProfileUpdater profiles, CollectorVerifier verifier,
                          CollectionPointService points, MunicipalRequestService municipalRequests,
                          MunicipalStaffService staff, WardLocator wardLocator, WardDirectory wards,
                          PickupScheduler scheduler, StopCompletionService completion,
                          PaymentConfirmationService payments, PickupInfoProvider pickupInfo,
                          ActivityLog activity) {
        this.activity = activity;
        this.scheduler = scheduler;
        this.completion = completion;
        this.payments = payments;
        this.pickupInfo = pickupInfo;
        this.accounts = accounts;
        this.rateCards = rateCards;
        this.listings = listings;
        this.profiles = profiles;
        this.verifier = verifier;
        this.points = points;
        this.municipalRequests = municipalRequests;
        this.staff = staff;
        this.wardLocator = wardLocator;
        this.wards = wards;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (accounts.hasAnyUser()) {
            return;
        }
        Long demoWard = wardLocator.wardIdAt(BASE_LAT, BASE_LNG)
                .orElseThrow(() -> new IllegalStateException("Demo location is not inside any imported ward"));
        UserAccount officer = seedOfficers(demoWard);
        seedStaff(officer);
        seedCollectors();
        seedCollectionPoints(officer);
        seedOfficerHistory(officer);

        UserAccount garima = seedHousehold("9000000001", "Garima (demo)", 0.0000, 0.0000, null, 0);
        seedCompletedCollection(garima);
        seedHousehold("9000000002", "Asha Verma", 0.0004, 0.0003, "PET_BOTTLE", 6);
        UserAccount rahul = seedHousehold("9000000003", "Rahul Singh", -0.0004, 0.0002, "NEWSPAPER", 10);
        seedHousehold("9000000004", "Neha Gupta", 0.0006, -0.0003, "CARDBOARD", 12);
        seedHousehold("9000000005", "Imran Khan", -0.0003, -0.0004, "IRON_SCRAP", 3);
        seedHousehold("9000000006", "Pooja Mehta", 0.0002, 0.0005, "ALUMINIUM_CAN", 1.5);
        seedHousehold("9000000007", "Vikram Rao", 0.0001, -0.0005, "FOOD_WASTE", 8);

        municipalRequests.create(rahul.id(), new NewRequest("DUST_SWEEPINGS", 4, "Collected from the terrace and stairs"));
    }

    /** The ward officer of the demo ward, a second officer of another ward, and a city-wide commissioner. */
    private UserAccount seedOfficers(Long demoWard) {
        UserAccount officer = accounts.registerOfficer("9000000201", "Ward Officer (demo)", DEMO_PASSWORD, demoWard);
        accounts.registerOfficer("9000000200", "City Commissioner (demo)", DEMO_PASSWORD, null);
        return officer;
    }

    /**
     * What the officers have already done, so that the commissioner's ward screens are not empty on the first day:
     * the staff, drop-off points and dealer approvals that the seeding above set up are written to the activity log.
     */
    private void seedOfficerHistory(UserAccount officer) {
        Long ward = officer.wardId();
        activity.record(officer.id(), ward, "STAFF_ADDED", "Mahesh Behera");
        activity.record(officer.id(), ward, "STAFF_ADDED", "Sunil Nayak");
        activity.record(officer.id(), ward, "DEALER_VERIFIED", "Ramesh Scrap Traders");
        activity.record(officer.id(), ward, "DEALER_VERIFIED", "Sunita Compost Center");
        activity.record(officer.id(), ward, "POINT_ADDED", "Ward Office Drop-off Point");
    }

    private void seedStaff(UserAccount officer) {
        staff.create(officer.id(), new StaffInput("Mahesh Behera", "9000000301", DEMO_PASSWORD));
        staff.create(officer.id(), new StaffInput("Sunil Nayak", "9000000302", DEMO_PASSWORD));
    }

    private void seedCollectors() {
        UserAccount ramesh = registerVerified("9000000101", "Ramesh Kumar", Role.KABADIWALA,
                BASE_LAT + 0.004, BASE_LNG + 0.002);
        profiles.update(ramesh.id(), new CollectorBusinessProfile("Ramesh Scrap Traders",
                "Shop 12, Ward 15 Market", VehicleType.E_RICKSHAW, 8, "9 AM - 6 PM, Mon-Sat", true, null));
        rateCards.replace(ramesh.id(), new RateCardView(5, 200, 0, null, List.of(
                new RateItem("PET_BOTTLE", 12, 18), new RateItem("NEWSPAPER", 14, 19),
                new RateItem("CARDBOARD", 7, 10), new RateItem("IRON_SCRAP", 30, 36),
                new RateItem("ALUMINIUM_CAN", 100, 115), new RateItem("GLASS_BOTTLE", 3, 5))));
        verifier.setStatus(ramesh.id(), VerificationStatus.VERIFIED);

        UserAccount sunita = registerVerified("9000000102", "Sunita Devi", Role.COMPOST,
                BASE_LAT + 0.002, BASE_LNG + 0.004);
        profiles.update(sunita.id(), new CollectorBusinessProfile("Sunita Compost Center",
                "Community compost yard, Ward 15", VehicleType.MINI_TRUCK, 12, "6 AM - 12 PM, daily", true, null));
        rateCards.replace(sunita.id(), new RateCardView(5, 100, 50, 300.0, List.of(
                new RateItem("FOOD_WASTE", 0, 4))));
        verifier.setStatus(sunita.id(), VerificationStatus.VERIFIED);

        // Waiting for the ward officer to approve: lets the demo show the verification step.
        UserAccount kishan = registerVerified("9000000103", "Kishan Lal", Role.KABADIWALA,
                BASE_LAT - 0.003, BASE_LNG + 0.003);
        profiles.update(kishan.id(), new CollectorBusinessProfile("Kishan Scrap Mart",
                "Near the temple, Ward 15", VehicleType.CYCLE_RICKSHAW, 5, "10 AM - 5 PM, Mon-Sat", true, null));
        rateCards.replace(kishan.id(), new RateCardView(3, 150, 0, null, List.of(
                new RateItem("PET_BOTTLE", 11, 16), new RateItem("NEWSPAPER", 13, 17))));
    }

    private void seedCollectionPoints(UserAccount officer) {
        points.create(officer.id(), new PointInput("Ward Office Drop-off Point (demo)", "Ward Office, Ward 15",
                BASE_LAT + 0.003, BASE_LNG - 0.002, "Batteries, bulbs and tube lights, electronics, expired medicines",
                "10 AM - 5 PM, Mon-Sat", true));
        points.create(officer.id(), new PointInput("Community Center E-Waste Bin (demo)", "Community Center, Ward 15",
                BASE_LAT - 0.002, BASE_LNG + 0.004, "Phones, chargers, wires, batteries", "Open all day", true));
        points.create(officer.id(), new PointInput("Market Pharmacy Medicine Take-back (demo)", "Ward 15 Market",
                BASE_LAT + 0.004, BASE_LNG + 0.003, "Expired medicines only", "9 AM - 9 PM", true));
    }


    /**
     * One collection that already happened earlier this month: the demo household and two neighbours gave food
     * waste, the compost center picked it up and everyone confirmed the payment. It gives the dashboards real
     * numbers to show from the first minute, and it uses the same code paths as a live pickup. It is food waste so
     * that the open dry-waste pool below (the live demo) is not touched.
     */
    private void seedCompletedCollection(UserAccount garima) {
        UserAccount meera = registerVerified("9000000008", "Meera Das", Role.HOUSEHOLD, BASE_LAT + 0.0003, BASE_LNG - 0.0002);
        UserAccount sanjay = registerVerified("9000000009", "Sanjay Patra", Role.HOUSEHOLD, BASE_LAT - 0.0002, BASE_LNG + 0.0003);
        Long compost = accounts.findByPhone("9000000102").orElseThrow().id();

        record Gift(UserAccount owner, double kg) {
        }
        List<Gift> gifts = List.of(new Gift(garima, 6), new Gift(meera, 25), new Gift(sanjay, 24));
        Long poolId = null;
        java.util.Map<Long, Gift> byListing = new java.util.LinkedHashMap<>();
        for (Gift g : gifts) {
            var listing = listings.create(g.owner().id(), new CreateRequest("FOOD_WASTE", g.kg(), LocalDate.now(), ListingMode.POOL, null));
            poolId = listing.poolId();
            byListing.put(listing.id(), g);
        }
        PickupView pickup = scheduler.accept(compost, poolId, LocalDateTime.now().plusHours(2), LocalDateTime.now().plusHours(4));
        byListing.forEach((listingId, gift) -> {
            Long stopId = pickup.stops().stream().filter(st -> st.ownerName().equals(gift.owner().name())).findFirst().orElseThrow().stopId();
            completion.complete(compost, stopId, gift.kg(), PaymentMode.CASH);
            payments.respond(gift.owner().id(), listingId, true, null);
        });
    }

    /** Registers a demo account whose phone number is already proven. */
    private UserAccount registerVerified(String phone, String name, Role role, double lat, double lng) {
        UserAccount u = accounts.register(phone, name, DEMO_PASSWORD, role, lat, lng, "en", null);
        return accounts.markPhoneVerified(u.id());
    }

    private UserAccount seedHousehold(String phone, String name, double dLat, double dLng, String item, double kg) {
        UserAccount u = registerVerified(phone, name, Role.HOUSEHOLD, BASE_LAT + dLat, BASE_LNG + dLng);
        if (item != null) {
            listings.create(u.id(), new CreateRequest(item, kg, LocalDate.now(), ListingMode.POOL, null));
        }
        return u;
    }
}
