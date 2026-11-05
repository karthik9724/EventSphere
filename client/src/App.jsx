import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  useParams,
  Navigate
} from "react-router-dom";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SERVER_URL = API_URL.replace(/\/api$/, "");

const STUDENT_STORAGE = "eventsphere_student";
const ADMIN_STORAGE = "eventsphere_admin_token";

const categoryIcons = {
  Technical: "⌘",
  Cultural: "✦",
  Sports: "↗",
  Workshop: "✳",
  Other: "✧"
};

const defaultCategories = [
  "All",
  "Technical",
  "Cultural",
  "Sports",
  "Workshop",
  "Other"
];

/* HELPERS */

function formatDate(value) {
  if (!value) return "Date TBA";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date TBA"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
}

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit"
      });
}

/* REGISTRATION AND CANCELLATION DEADLINE HELPERS */

// Registration closes exactly 48 hours before the event.
function getRegistrationDeadline(eventDate) {
  if (!eventDate) return null;

  const date = new Date(eventDate);

  if (Number.isNaN(date.getTime())) return null;

  return new Date(date.getTime() - 48 * 60 * 60 * 1000);
}

function isRegistrationClosed(eventDate) {
  const deadline = getRegistrationDeadline(eventDate);

  if (!deadline) return true;

  return Date.now() >= deadline.getTime();
}

// Cancellation closes exactly 24 hours before the event.
function getCancellationDeadline(eventDate) {
  if (!eventDate) return null;

  const date = new Date(eventDate);

  if (Number.isNaN(date.getTime())) return null;

  return new Date(date.getTime() - 24 * 60 * 60 * 1000);
}

function isCancellationClosed(eventDate) {
  const deadline = getCancellationDeadline(eventDate);

  if (!deadline) return true;

  return Date.now() >= deadline.getTime();
}

function readResponse(response) {
  return response.json().catch(() => ({})).then(data => {
    if (!response.ok) {
      throw new Error(data.message || "Something went wrong.");
    }

    return data;
  });
}

function getSavedStudent() {
  try {
    return JSON.parse(
      sessionStorage.getItem(STUDENT_STORAGE) || "null"
    );
  } catch {
    return null;
  }
}

function getSavedAdminToken() {
  return sessionStorage.getItem(ADMIN_STORAGE) || "";
}

function getAccountRole(account) {
  return account?.role || account?.student?.role || "";
}

/* WELCOME MESSAGE */

function getWelcomeMessage(account) {
  const profile = account?.student || account;
  const name = String(profile?.name || "").trim();

  if (name) {
    return `Welcome, ${name}!`;
  }

  if (account?.role === "admin") {
    return "Welcome, Admin!";
  }

  return "Welcome!";
}

function getImageUrl(imagePath) {
  if (!imagePath) return "";

  if (
    imagePath.startsWith("http://") ||
    imagePath.startsWith("https://")
  ) {
    return imagePath;
  }

  return `${SERVER_URL}${imagePath.startsWith("/") ? "" : "/"}${imagePath}`;
}

function getRegisteredCount(event) {
  return Number(event?.registeredCount || 0);
}

function getMaxCapacity(event) {
  return Number(event?.maxCapacity || 100);
}

function getAvailableSeats(event) {
  if (event?.availableSeats !== undefined) {
    return Math.max(0, Number(event.availableSeats));
  }

  return Math.max(
    0,
    getMaxCapacity(event) - getRegisteredCount(event)
  );
}

/* GCET ROLL NUMBER AND EMAIL VALIDATION */

function normalizeRollNumber(value) {
  return String(value || "").trim().toUpperCase();
}

function getCollegeEmail(rollNumber) {
  return `${normalizeRollNumber(rollNumber).toLowerCase()}@gcet.edu.in`;
}

const GCET_ROLL_PATTERN =
  /^23R11A05(?:0[1-9]|[1-9]\d|[A-Y]\d|Z0)$/;

function validateCollegeDetails(rollNumber, email) {
  const cleanRoll = normalizeRollNumber(rollNumber);
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!GCET_ROLL_PATTERN.test(cleanRoll)) {
    return "Enter a valid GCET roll number, for example 23R11A0597 or 23R11A05A0.";
  }

  const expectedEmail = getCollegeEmail(cleanRoll);

  if (cleanEmail !== expectedEmail) {
    return `Your email must be ${expectedEmail}`;
  }

  return "";
}

function validateCollegeEmail(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();

  const emailPattern =
    /^23r11a05(?:0[1-9]|[1-9]\d|[a-y]\d|z0)@gcet\.edu\.in$/;

  if (!emailPattern.test(cleanEmail)) {
    return "Enter your valid GCET email, for example 23r11a0597@gcet.edu.in.";
  }

  return "";
}

/* NAVBAR */

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [account, setAccount] = useState(getSavedStudent());
  const [adminToken, setAdminToken] = useState(getSavedAdminToken());

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const sync = () => {
      setAccount(getSavedStudent());
      setAdminToken(getSavedAdminToken());
    };

    window.addEventListener("storage", sync);
    window.addEventListener("eventsphere-auth", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("eventsphere-auth", sync);
    };
  }, []);

  function logout() {
    sessionStorage.removeItem(STUDENT_STORAGE);
    sessionStorage.removeItem(ADMIN_STORAGE);

    setAccount(null);
    setAdminToken("");

    window.dispatchEvent(new Event("eventsphere-auth"));

    navigate("/login", { replace: true });
  }

  const role = getAccountRole(account);
  const isStudentOrCoordinator = Boolean(account?.token);
  const isAdmin = Boolean(adminToken);
  const isLoggedIn = isStudentOrCoordinator || isAdmin;

  const isAuthPage =
    location.pathname === "/" ||
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/register");

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/login" className="logo">
          <span className="logo-icon">E</span>
          <span>
            Event<span className="logo-accent">Sphere</span>
          </span>
        </Link>

        {!isAuthPage && (
          <>
            <button
              className="menu-toggle"
              type="button"
              onClick={() => setMenuOpen(value => !value)}
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              {menuOpen ? "✕" : "☰"}
            </button>

            <div className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
              {isLoggedIn ? (
                <>
                  <Link to="/events">Events</Link>

                  {isStudentOrCoordinator && role === "student" && (
                    <Link to="/my-registrations">
                      My Registrations
                    </Link>
                  )}

                  {isStudentOrCoordinator && role === "coordinator" && (
                    <>
                      <Link to="/request-event">Submit Event</Link>
                      <Link to="/coordinator/events">My Events</Link>
                    </>
                  )}

                  {isAdmin && (
                    <Link to="/admin">Admin Dashboard</Link>
                  )}

                  <button
                    type="button"
                    className="nav-logout"
                    onClick={logout}
                  >
                    Logout ↗
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login">Login</Link>
                  <Link to="/events">Events</Link>

                  <Link to="/login" className="nav-cta">
                    Get Started ↗
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

/* FOOTER */

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} EventSphere</span>
      </div>
    </footer>
  );
}

/* EVENT CARD */

function EventCard({ event, isRegistered = false }) {
  const category = event.category || "Other";
  const icon = categoryIcons[category] || categoryIcons.Other;

  const registered = getRegisteredCount(event);
  const maximum = getMaxCapacity(event);
  const available = getAvailableSeats(event);
  const imageUrl = getImageUrl(event.imageUrl);

  const registrationDeadline = getRegistrationDeadline(event.date);
  const registrationClosed = isRegistrationClosed(event.date);

  const cancellationDeadline = getCancellationDeadline(event.date);
  const cancellationClosed = isCancellationClosed(event.date);

  return (
    <article className="premium-event-card">
      {imageUrl ? (
        <div className="premium-event-art event-image-container">
          <img
            src={imageUrl}
            alt={event.title}
            className="event-card-image"
          />

          <span className="premium-category">{category}</span>
        </div>
      ) : (
        <div
          className={`premium-event-art art-${category
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")}`}
        >
          <span className="premium-art-mark">{icon}</span>
          <span className="premium-category">{category}</span>
          <span className="premium-art-orbit" />
        </div>
      )}

      <div className="premium-event-body">
        <h3 title={event.title}>{event.title}</h3>

        <div className="premium-event-detail">
          <span className="detail-icon">▦</span>
          <span>
            {formatDate(event.date)}
            {formatTime(event.date)
              ? ` · ${formatTime(event.date)}`
              : ""}
          </span>
        </div>

        <div className="premium-event-detail">
          <span className="detail-icon">⌖</span>
          <span>{event.venue || "Venue TBA"}</span>
        </div>

        <div className="premium-event-detail">
          <span className="detail-icon">♧</span>
          <span>Total Registered: {registered}</span>
        </div>

        <div className="premium-event-detail">
          <span className="detail-icon">◉</span>
          <span>Seats Available: {available}</span>
        </div>

        <div className="premium-event-detail">
          <span className="detail-icon">▤</span>
          <span>Maximum Capacity: {maximum}</span>
        </div>

        {/* REGISTRATION DEADLINE */}
        <div
          className="premium-event-detail"
          style={{
            color: registrationClosed ? "#dc2626" : "#16803c",
            fontWeight: 600
          }}
        >
          <span className="detail-icon">⏳</span>
          <span>
            {registrationClosed
              ? "Registration Closed"
              : `Registration closes: ${formatDate(registrationDeadline)} · ${formatTime(registrationDeadline)}`}
          </span>
        </div>

        {/* CANCELLATION DEADLINE */}
        <div
          className="premium-event-detail"
          style={{
            color: cancellationClosed ? "#dc2626" : "#16803c",
            fontWeight: 600
          }}
        >
          <span className="detail-icon">⏳</span>
          <span>
            {cancellationClosed
              ? "Cancellation Closed"
              : `Cancellation available until: ${formatDate(cancellationDeadline)} · ${formatTime(cancellationDeadline)}`}
          </span>
        </div>

        <div className="premium-event-organizer">
          <span className="premium-organizer-avatar">
            {(event.organizer || "E").trim().charAt(0).toUpperCase()}
          </span>

          <span>{event.organizer || "Event organizer"}</span>
        </div>

        {isRegistered && (
          <div
            className="student-event-registered"
            role="status"
            style={{
              color: "#16803c",
              fontWeight: 700,
              marginTop: 12,
              padding: "9px 12px",
              background: "#eaf8ef",
              borderRadius: 8,
              textAlign: "center"
            }}
          >
            ✓ REGISTERED
          </div>
        )}

        <Link
          className="event-details-link"
          to={`/events/${event._id}`}
        >
          View event details ↗
        </Link>
      </div>
    </article>
  );
}

/* PUBLIC HOME PAGE */

function Home() {
  const [featured, setFeatured] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/events`, {
      signal: controller.signal
    })
      .then(readResponse)
      .then(data => {
        setFeatured(
          (Array.isArray(data) ? data : data.events || []).slice(0, 3)
        );
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          setError("Could not load featured events.");
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <main>
      <section className="hero">
        <div className="hero-glow" />

        <div className="hero-content">
          <div className="hero-pill">
            <span>✦</span> CAMPUS EVENTS, ALL IN ONE PLACE
          </div>

          <h1>
            Make your campus
            <br />
            <span>moments count.</span>
          </h1>

          <p>Find events. Meet your people. Make memories.</p>

          <div className="hero-actions">
            <Link to="/events" className="btn btn-primary">
              Explore Events ↗
            </Link>

            {getAccountRole(getSavedStudent()) === "coordinator" && (
              <Link to="/request-event" className="btn btn-secondary">
                Submit Event
              </Link>
            )}
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-visual-orbit">
            <div className="hero-center-art">
              <div className="hero-art-circle">E</div>
              <span>✦</span>
            </div>

            <div className="hero-float-card hero-card-one">
              <span className="float-icon">⌘</span>
              <div>
                <strong>Tech</strong>
                <small>Build something</small>
              </div>
            </div>

            <div className="hero-float-card hero-card-two">
              <span className="float-icon">✦</span>
              <div>
                <strong>Culture</strong>
                <small>Share your talent</small>
              </div>
            </div>

            <div className="hero-float-card hero-card-three">
              <span className="float-icon">↗</span>
              <div>
                <strong>Community</strong>
                <small>Find your people</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="category-section section-container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">EXPLORE</span>
            <h2>Find your kind of event</h2>
          </div>

          <Link to="/events" className="text-link">
            All events ↗
          </Link>
        </div>

        <div className="category-grid">
          {["Technical", "Cultural", "Sports", "Workshop"].map(category => (
            <Link
              key={category}
              to={`/events?category=${encodeURIComponent(category)}`}
              className="category-card"
            >
              <span className="category-icon">
                {categoryIcons[category]}
              </span>

              <h3>{category}</h3>

              <span className="category-arrow">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="featured-section section-container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">HANDPICKED FOR YOU</span>
            <h2>Upcoming events</h2>
          </div>

          <Link to="/events" className="text-link">
            View all ↗
          </Link>
        </div>

        {error && <div className="form-error">{error}</div>}

        {featured.length > 0 ? (
          <div className="events-grid">
            {featured.map(event => (
              <EventCard key={event._id} event={event} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>New events are on the way</h3>

            <Link to="/events" className="btn btn-primary">
              Browse events
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

/* EVENTS LIST */

function Events() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registeredEventIds, setRegisteredEventIds] = useState([]);

  const location = useLocation();
  const currentStudent = getSavedStudent();

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("category");

    const match = defaultCategories.find(
      item => item.toLowerCase() === (requested || "").toLowerCase()
    );

    setActiveCategory(match || "All");
  }, [location.search]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/events`, {
      signal: controller.signal
    })
      .then(readResponse)
      .then(data => {
        setEvents(Array.isArray(data) ? data : data.events || []);
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          setError("Could not connect to the events service.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!currentStudent?.token || getAccountRole(currentStudent) !== "student") {
      setRegisteredEventIds([]);
      return;
    }

    const controller = new AbortController();

    fetch(`${API_URL}/my-registrations`, {
      headers: {
        Authorization: `Bearer ${currentStudent.token}`
      },
      signal: controller.signal
    })
      .then(readResponse)
      .then(data => {
        const ids = (data.registrations || [])
          .filter(item => Boolean(item.myTicket))
          .map(item => String(item.event?._id || item.event));
        setRegisteredEventIds(ids);
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          console.error("Could not load registered event statuses:", err);
        }
      });

    return () => controller.abort();
  }, []);

  const categories = useMemo(
    () => [
      "All",
      ...new Set(events.map(e => e.category).filter(Boolean))
    ],
    [events]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return events
      .filter(event => {
        const matchesCategory =
          activeCategory === "All" ||
          event.category === activeCategory;

        const searchable = [
          event.title,
          event.description,
          event.venue,
          event.organizer,
          event.category
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return matchesCategory && searchable.includes(term);
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [events, search, activeCategory]);

  function reset() {
    setSearch("");
    setActiveCategory("All");
  }

  return (
    <main className="premium-events-page">
      <div className="premium-events-layout">
        <aside className="premium-events-sidebar">
          <div className="premium-sidebar-title">
            <span className="premium-sidebar-symbol">✦</span>
            <span>Discover</span>
          </div>

          <p className="premium-sidebar-label">BROWSE</p>

          <div className="premium-sidebar-categories">
            {categories.map(category => (
              <button
                key={category}
                className={`premium-sidebar-category ${
                  activeCategory === category ? "selected" : ""
                }`}
                onClick={() => setActiveCategory(category)}
              >
                <span className="sidebar-category-icon">
                  {categoryIcons[category] || "◈"}
                </span>

                <span>{category}</span>
              </button>
            ))}
          </div>

          <div className="premium-sidebar-bottom">
            <span className="sidebar-mini-mark">E</span>
            <span>EventSphere</span>
          </div>
        </aside>

        <section className="premium-events-main">
          <header className="premium-events-header">
            <div>
              <span className="premium-overline">
                CAMPUS / DISCOVER
              </span>

              <h1>
                Discover events<span className="heading-period">.</span>
              </h1>

              <p className="premium-events-subtitle">
                Find what's happening around you.
              </p>
            </div>

            {getAccountRole(getSavedStudent()) === "coordinator" && (
              <Link
                to="/request-event"
                className="premium-submit-button"
              >
                ＋ Submit event
              </Link>
            )}
          </header>

          <div className="premium-search-row">
            <label className="premium-search-box">
              <span className="premium-search-icon">⌕</span>

              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search events, venues, organizers..."
              />
            </label>

            <span className="premium-event-count">
              {loading ? "…" : `${filtered.length} events`}
            </span>
          </div>

          <div className="premium-mobile-filters">
            {categories.map(category => (
              <button
                key={category}
                className={`premium-filter-chip ${
                  activeCategory === category ? "selected" : ""
                }`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="premium-results-line">
            <h2>
              {activeCategory === "All" ? "All events" : activeCategory}
            </h2>

            {(search || activeCategory !== "All") && (
              <button
                className="premium-clear-button"
                onClick={reset}
              >
                Clear filters ×
              </button>
            )}
          </div>

          {loading && (
            <div className="premium-state">
              <span className="loading-spinner" />
              Loading events
            </div>
          )}

          {!loading && error && (
            <div className="premium-state premium-error">
              {error}

              <button onClick={() => window.location.reload()}>
                Try again
              </button>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="premium-events-grid">
              {filtered.map(event => (
                <EventCard
                  key={event._id}
                  event={event}
                  isRegistered={registeredEventIds.includes(String(event._id))}
                />
              ))}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="premium-empty-state">
              <span className="premium-empty-icon">⌕</span>
              <h3>No events found</h3>
              <p>Try another search or category.</p>

              <button
                className="premium-reset-button"
                onClick={reset}
              >
                Reset filters
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* EVENT DETAILS AND MULTI-SEAT REGISTRATION */

function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [seatQuantity, setSeatQuantity] = useState(1);
  const [attendees, setAttendees] = useState([]);

  const [showRegisteredModal, setShowRegisteredModal] = useState(false);
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState("");

  const student = getSavedStudent();
  const studentProfile = student?.student || {};
  const isCoordinator = getAccountRole(student) === "coordinator";

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setEvent(null);
    setError("");

    fetch(`${API_URL}/events/${id}`, {
      signal: controller.signal
    })
      .then(readResponse)
      .then(data => setEvent(data.event || data))
      .catch(err => {
        if (err.name !== "AbortError") {
          setError(err.message || "Could not load this event.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id]);

  const availableSeats = getAvailableSeats(event);
  const registeredCount = getRegisteredCount(event);
  const maximumCapacity = getMaxCapacity(event);
  const maxBookableSeats = Math.min(5, availableSeats);

  // Registration and cancellation deadline information
  const registrationDeadline = getRegistrationDeadline(event?.date);
  const registrationClosed = isRegistrationClosed(event?.date);

  const cancellationDeadline = getCancellationDeadline(event?.date);
  const cancellationClosed = isCancellationClosed(event?.date);

  useEffect(() => {
    if (seatQuantity > maxBookableSeats) {
      setSeatQuantity(Math.max(1, maxBookableSeats));
    }

    setAttendees(previous => {
      const required = Math.max(0, seatQuantity);

      return Array.from({ length: required }, (_, index) => (
        previous[index] || { name: "", rollNumber: "" }
      ));
    });
  }, [seatQuantity, maxBookableSeats]);

  async function viewRegisteredStudents() {
    setShowRegisteredModal(true);
    setStudentsError("");
    setLoadingStudents(true);
    setRegisteredStudents([]);

    try {
      const response = await fetch(
        `${API_URL}/coordinator/events/${id}/registrations`,
        {
          headers: {
            Authorization: `Bearer ${student.token}`
          }
        }
      );

      const data = await readResponse(response);
      setRegisteredStudents(data.attendees || []);
    } catch (err) {
      setStudentsError(
        err.message || "Could not load registered students."
      );
    } finally {
      setLoadingStudents(false);
    }
  }

  function updateAttendee(index, field, value) {
    setAttendees(previous =>
      previous.map((attendee, attendeeIndex) =>
        attendeeIndex === index
          ? { ...attendee, [field]: value }
          : attendee
      )
    );
  }

  async function registerForEvent() {
    const role = getAccountRole(student);

    if (!student?.token) {
      navigate("/login", {
        state: { from: `/events/${id}` }
      });
      return;
    }

    if (role !== "student") {
      setError("Only student accounts can book tickets.");
      return;
    }

    if (isRegistrationClosed(event?.date)) {
      setError(
        "Registration is closed. Ticket booking must be completed at least 2 days before the event."
      );
      return;
    }

    if (availableSeats <= 0) {
      setError("Sorry, this event is full.");
      return;
    }

    if (
      !Number.isInteger(seatQuantity) ||
      seatQuantity < 1 ||
      seatQuantity > 5
    ) {
      setError("You can book between 1 and 5 tickets.");
      return;
    }

    if (seatQuantity > availableSeats) {
      setError(`Only ${availableSeats} seats are available.`);
      return;
    }

    if (attendees.length !== seatQuantity) {
      setError("Please enter a GCET roll number for every ticket.");
      return;
    }

    const allRollNumbers = [];

    for (let index = 0; index < attendees.length; index++) {
      const roll = normalizeRollNumber(attendees[index].rollNumber);

      if (!roll) {
        setError(`Please enter the roll number for ticket ${index + 1}.`);
        return;
      }

      if (!GCET_ROLL_PATTERN.test(roll)) {
        setError(`Enter a valid GCET roll number for ticket ${index + 1}.`);
        return;
      }

      allRollNumbers.push(roll);
    }

    if (new Set(allRollNumbers).size !== allRollNumbers.length) {
      setError(
        "Duplicate roll number found. Each ticket must belong to a different student."
      );
      return;
    }

    try {
      setBusy(true);
      setError("");
      setMessage("");

      const response = await fetch(`${API_URL}/events/${id}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${student.token}`
        },
        body: JSON.stringify({
          seats: seatQuantity,
          attendees: allRollNumbers.map(rollNumber => ({ rollNumber }))
        })
      });

      const data = await readResponse(response);

      setMessage(
        data.message || `${seatQuantity} ticket(s) booked successfully.`
      );

      setEvent(previous =>
        previous
          ? {
              ...previous,
              registeredCount:
                data.registeredCount ?? registeredCount + seatQuantity,
              availableSeats:
                data.availableSeats ?? Math.max(0, availableSeats - seatQuantity)
            }
          : previous
      );

      setSeatQuantity(1);
      setAttendees([{ name: "", rollNumber: "" }]);
    } catch (err) {
      setError(err.message || "Booking failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="form-page">
        <section className="form-panel">
          Loading event details...
        </section>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="form-page">
        <section className="form-panel">
          <h2>Event not found</h2>
          <p>{error}</p>

          <Link className="btn btn-primary" to="/events">
            Back to events
          </Link>
        </section>
      </main>
    );
  }

  const category = event.category || "Other";
  const imageUrl = getImageUrl(event.imageUrl);

  return (
    <main className="detail-page">
      <div className="detail-shell">
        <Link to="/events" className="back-link">
          ← Back to events
        </Link>

        {imageUrl ? (
          <div className="detail-hero event-detail-image-container">
            <img
              src={imageUrl}
              alt={event.title}
              className="event-detail-image"
            />

            <span className="premium-category">{category}</span>
          </div>
        ) : (
          <div
            className={`detail-hero art-${category
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "")}`}
          >
            <span className="premium-category">{category}</span>

            <span className="detail-hero-symbol">
              {categoryIcons[category] || "✧"}
            </span>

            <span className="detail-hero-caption">
              EVENTSPHERE / CAMPUS EVENT
            </span>
          </div>
        )}

        <section className="detail-content">
          <div className="detail-main">
            <span className="eyebrow">EVENT DETAILS</span>

            <h1>{event.title}</h1>

            <p className="detail-description">
              {event.description}
            </p>

            <div className="detail-info-grid">
              <div className="detail-info">
                <span>DATE</span>
                <strong>{formatDate(event.date)}</strong>
              </div>

              <div className="detail-info">
                <span>TIME</span>
                <strong>{formatTime(event.date) || "Time TBA"}</strong>
              </div>

              <div className="detail-info">
                <span>VENUE</span>
                <strong>{event.venue || "Venue TBA"}</strong>
              </div>

              <div className="detail-info">
                <span>ORGANIZER</span>
                <strong>{event.organizer || "Event organizer"}</strong>
              </div>

              <div className="detail-info">
                <span>COORDINATOR PHONE</span>
                <strong>
                  {event.coordinatorPhone ? (
                    <a href={`tel:${event.coordinatorPhone}`}>
                      {event.coordinatorPhone}
                    </a>
                  ) : (
                    "Not provided"
                  )}
                </strong>
              </div>

              <div className="detail-info">
                <span>TOTAL REGISTERED</span>
                <strong>{registeredCount}</strong>
              </div>

              <div className="detail-info">
                <span>SEATS AVAILABLE</span>
                <strong>{availableSeats}</strong>
              </div>

              <div className="detail-info">
                <span>MAXIMUM CAPACITY</span>
                <strong>{maximumCapacity}</strong>
              </div>

              {/* REGISTRATION DEADLINE */}
              <div className="detail-info">
                <span>REGISTRATION DEADLINE</span>

                <strong
                  style={{
                    color: registrationClosed ? "#dc2626" : "#16803c"
                  }}
                >
                  {registrationClosed
                    ? "Registration Closed"
                    : `${formatDate(registrationDeadline)} · ${formatTime(registrationDeadline)}`}
                </strong>
              </div>

              {/* CANCELLATION DEADLINE */}
              <div className="detail-info">
                <span>CANCELLATION DEADLINE</span>

                <strong
                  style={{
                    color: cancellationClosed ? "#dc2626" : "#16803c"
                  }}
                >
                  {cancellationClosed
                    ? "Cancellation Closed"
                    : `${formatDate(cancellationDeadline)} · ${formatTime(cancellationDeadline)}`}
                </strong>
              </div>
            </div>

            {isCoordinator && (
              <button
                type="button"
                className="view-registered-button"
                onClick={viewRegisteredStudents}
              >
                <span>♧ View Registered Students</span>
                <span className="view-registered-count">
                  {registeredCount}
                </span>
              </button>
            )}
          </div>

          {!isCoordinator && (
            <aside className="detail-register-panel">
              <span className="eyebrow">JOIN THE EXPERIENCE</span>

              <h2>Book Tickets</h2>

              {registrationClosed && (
                <div className="form-error" role="alert">
                  Registration is closed. Ticket booking must be completed
                  at least 2 days before the event.
                </div>
              )}

              <p>
                Enter your college roll number and choose how many seats
                you want to book.
              </p>

              <div className="booking-capacity">
                <div>
                  <span>Total Registered</span>
                  <strong>{registeredCount}</strong>
                </div>

                <div>
                  <span>Seats Available</span>
                  <strong>{availableSeats}</strong>
                </div>

                <div>
                  <span>Maximum Capacity</span>
                  <strong>{maximumCapacity}</strong>
                </div>
              </div>

              {student?.token && getAccountRole(student) === "student" && (
                <>
                  <div className="booking-student-info">
                    <strong>Booking owner</strong>
                    <p>{studentProfile.name || "Student"}</p>
                    <p>
                      Enter the GCET roll number of every ticket holder below.
                      Your own ticket is optional.
                    </p>
                  </div>

                  <div className="form-group booking-quantity-group">
                    <label htmlFor="seatQuantity">
                      Number of tickets
                    </label>

                    <div className="seat-quantity-control">
                      <button
                        type="button"
                        aria-label="Decrease seats"
                        disabled={seatQuantity <= 1 || busy}
                        onClick={() =>
                          setSeatQuantity(value => Math.max(1, value - 1))
                        }
                      >
                        −
                      </button>

                      <input
                        id="seatQuantity"
                        type="number"
                        min="1"
                        max={maxBookableSeats}
                        value={seatQuantity}
                        disabled={
                          busy || availableSeats === 0 || registrationClosed
                        }
                        onChange={e => {
                          const value = Number(e.target.value);

                          if (Number.isInteger(value)) {
                            setSeatQuantity(
                              Math.max(
                                1,
                                Math.min(maxBookableSeats || 1, value)
                              )
                            );
                          }
                        }}
                      />

                      <button
                        type="button"
                        aria-label="Increase seats"
                        disabled={
                          seatQuantity >= maxBookableSeats ||
                          busy ||
                          registrationClosed
                        }
                        onClick={() =>
                          setSeatQuantity(value =>
                            Math.min(maxBookableSeats, value + 1)
                          )
                        }
                      >
                        +
                      </button>
                    </div>

                    <small>
                      Select 1 to {Math.min(5, availableSeats)} tickets.
                      Your total booking for this event cannot exceed 5 tickets.
                    </small>
                  </div>

                  {seatQuantity >= 1 && (
                    <div className="additional-attendees">
                      <h3>Ticket holder details</h3>

                      <p>
                        Enter the GCET roll number for every ticket. Include
                        your own roll number only if you are attending.
                      </p>

                      {attendees.map((attendee, index) => (
                        <div className="attendee-form-card" key={index}>
                          <h4>Ticket {index + 1}</h4>

                          <div className="form-group">
                            <label>Roll number *</label>

                            <input
                              type="text"
                              value={attendee.rollNumber}
                              onChange={e =>
                                updateAttendee(
                                  index,
                                  "rollNumber",
                                  e.target.value.toUpperCase()
                                )
                              }
                              maxLength={10}
                              placeholder="23R11A0597"
                              required
                              disabled={registrationClosed}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {message && (
                <div className="form-success" role="status">
                  {message}
                </div>
              )}

              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <button
                className="btn btn-primary form-submit"
                onClick={registerForEvent}
                disabled={
                  busy || availableSeats <= 0 || registrationClosed
                }
              >
                {busy
                  ? "Booking..."
                  : registrationClosed
                    ? "Registration Closed"
                    : availableSeats <= 0
                      ? "Event full"
                      : "Book Tickets ↗"}
              </button>

              {student?.token && getAccountRole(student) === "student" && (
                <Link
                  className="detail-secondary-link"
                  to="/my-registrations"
                >
                  View my registrations
                </Link>
              )}
            </aside>
          )}
        </section>

        {showRegisteredModal && (
          <div
            className="registered-modal-overlay"
            onClick={() => setShowRegisteredModal(false)}
          >
            <div
              className="registered-modal"
              onClick={e => e.stopPropagation()}
            >
              <div className="registered-modal-header">
                <div>
                  <span className="eyebrow">COORDINATOR PORTAL</span>
                  <h2>Registered Students</h2>
                  <p>{event.title}</p>
                </div>

                <button
                  type="button"
                  className="registered-modal-close"
                  onClick={() => setShowRegisteredModal(false)}
                  aria-label="Close popup"
                >
                  ×
                </button>
              </div>

              <div className="registered-modal-count">
                <span>Total Registered</span>
                <strong>{registeredStudents.length}</strong>
              </div>

              <div className="registered-modal-list">
                {loadingStudents ? (
                  <p className="registered-modal-message">
                    Loading students...
                  </p>
                ) : studentsError ? (
                  <p className="registered-modal-error">
                    {studentsError}
                  </p>
                ) : registeredStudents.length > 0 ? (
                  registeredStudents.map((person, index) => (
                    <div
                      className="registered-student-row"
                      key={`${person.rollNumber}-${index}`}
                    >
                      <span className="registered-student-number">
                        {index + 1}
                      </span>

                      <div className="registered-student-info">
                        <strong>{person.name || "Student"}</strong>
                        <span>{person.rollNumber}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="registered-modal-message">
                    No students have registered yet.
                  </p>
                )}
              </div>

              <button
                type="button"
                className="registered-modal-done"
                onClick={() => setShowRegisteredModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* EVENT SUBMISSION - COORDINATORS ONLY */

function RequestEvent() {
  const navigate = useNavigate();
  const account = getSavedStudent();
  const role = getAccountRole(account);
  const coordinatorProfile = account?.student || {};

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    venue: "",
    category: "Technical",
    organizer: "",
    maxCapacity: "100",
    coordinatorPhone: coordinatorProfile.phoneNumber || ""
  });

  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!account?.token || role !== "coordinator") {
      navigate("/login", { replace: true });
    }
  }, []);

  function handleChange(e) {
    setFormData(previous => ({
      ...previous,
      [e.target.name]: e.target.value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const maxCapacity = Number(formData.maxCapacity);
    const phoneDigits = formData.coordinatorPhone.replace(/\D/g, "");

    if (!Number.isInteger(maxCapacity) || maxCapacity < 1) {
      setError("Maximum capacity must be at least 1.");
      return;
    }

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError("Please enter a valid coordinator phone number.");
      return;
    }

    if (!image) {
      setError("Please upload an event image.");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (!allowedTypes.includes(image.type)) {
      setError("Please upload a JPG, PNG, WEBP, or GIF image.");
      return;
    }

    if (image.size > 5 * 1024 * 1024) {
      setError("Image size must be 5 MB or less.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const payload = new FormData();

      Object.entries({
        ...formData,
        date: new Date(formData.date).toISOString(),
        maxCapacity,
        coordinatorPhone: formData.coordinatorPhone.trim()
      }).forEach(([key, value]) => {
        payload.append(key, String(value));
      });

      payload.append("image", image);

      const response = await fetch(`${API_URL}/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.token}`
        },
        body: payload
      });

      await readResponse(response);

      setMessage(
        "Event submitted successfully. It will appear after admin approval."
      );

      setFormData({
        title: "",
        description: "",
        date: "",
        venue: "",
        category: "Technical",
        organizer: "",
        maxCapacity: "100",
        coordinatorPhone: coordinatorProfile.phoneNumber || ""
      });

      setImage(null);

      const fileInput = document.getElementById("eventImage");

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (err) {
      setError(err.message || "Could not submit event.");
    } finally {
      setLoading(false);
    }
  }

  if (!account?.token || role !== "coordinator") {
    return (
      <main className="form-page">
        <section className="form-panel">
          Redirecting to coordinator login...
        </section>
      </main>
    );
  }

  return (
    <main className="form-page">
      <div className="form-intro">
        <span className="eyebrow">COORDINATOR PORTAL</span>

        <h1>
          Submit an <span>event.</span>
        </h1>

        <p>Share your event idea with your campus.</p>
      </div>

      <section className="form-panel">
        <div className="form-panel-heading">
          <h2>Complete event details</h2>
        </div>

        {message && <div className="form-success">{message}</div>}
        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit} className="event-form">
          <div className="form-group">
            <label>Event title *</label>

            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              maxLength={120}
              required
            />
          </div>

          <div className="form-group">
            <label>Description *</label>

            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              maxLength={2000}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date and time *</label>

              <input
                name="date"
                type="datetime-local"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Event category *</label>

              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
              >
                <option>Technical</option>
                <option>Cultural</option>
                <option>Sports</option>
                <option>Workshop</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Venue *</label>

            <input
              name="venue"
              value={formData.venue}
              onChange={handleChange}
              maxLength={200}
              required
            />
          </div>

          <div className="form-group">
            <label>Organizer *</label>

            <input
              name="organizer"
              value={formData.organizer}
              onChange={handleChange}
              maxLength={120}
              required
            />
          </div>

          <div className="form-group">
            <label>Maximum capacity *</label>

            <input
              name="maxCapacity"
              type="number"
              min="1"
              value={formData.maxCapacity}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Coordinator phone number *</label>

            <input
              name="coordinatorPhone"
              type="tel"
              value={formData.coordinatorPhone}
              onChange={handleChange}
              minLength={10}
              maxLength={15}
              placeholder="Enter contact phone number"
              autoComplete="tel"
              required
            />

            <small>
              Students can use this number to contact the event coordinator.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="eventImage">Event image *</label>

            <input
              id="eventImage"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={e => setImage(e.target.files?.[0] || null)}
              required
            />

            <small>
              Upload JPG, PNG, WEBP, or GIF. Maximum size: 5 MB.
            </small>

            {image && (
              <p className="form-note">
                Selected image: {image.name}
              </p>
            )}
          </div>

          <div className="form-note">
            ⓘ Your event will be visible to students only after admin approval.
          </div>

          <button
            className="btn btn-primary form-submit"
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit for approval ↗"}
          </button>
        </form>
      </section>
    </main>
  );
}

/* LOGIN PAGE - THREE ROLE OPTIONS */

function AuthChoicePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedRole, setSelectedRole] = useState(
    location.state?.role || "student"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const roles = [
    { id: "student", label: "Student", icon: "🎓" },
    { id: "coordinator", label: "Coordinator", icon: "📅" },
    { id: "admin", label: "Admin", icon: "🛡️" }
  ];

  async function handleLogin(e) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (selectedRole !== "admin") {
        const validationError = validateCollegeEmail(cleanEmail);

        if (validationError) {
          throw new Error(validationError);
        }

        const response = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            role: selectedRole
          })
        });

        const data = await readResponse(response);
        const account = data.account || data.student || data.user;

        if (!data.token || !account) {
          throw new Error("The server returned incomplete login details.");
        }

        if (
          account.role &&
          account.role !== selectedRole
        ) {
          throw new Error("Please select the correct login role.");
        }

        if (
          account.rollNumber &&
          getCollegeEmail(account.rollNumber) !== cleanEmail
        ) {
          throw new Error("Your account email does not match its roll number.");
        }

        const savedAccount = {
          token: data.token,
          student: account,
          role: selectedRole
        };

        sessionStorage.setItem(
          STUDENT_STORAGE,
          JSON.stringify(savedAccount)
        );

        sessionStorage.removeItem(ADMIN_STORAGE);

        window.dispatchEvent(new Event("eventsphere-auth"));

        const destination =
          location.state?.from ||
          (selectedRole === "student"
            ? "/my-registrations"
            : "/coordinator/events");

        navigate(destination, { replace: true });
        return;
      }

      const response = await fetch(`${API_URL}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: cleanEmail,
          password
        })
      });

      const data = await readResponse(response);

      if (!data.token) {
        throw new Error("Admin token was not returned.");
      }

      sessionStorage.setItem(ADMIN_STORAGE, data.token);
      sessionStorage.removeItem(STUDENT_STORAGE);

      window.dispatchEvent(new Event("eventsphere-auth"));

      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="form-page login-page">
      <div className="form-intro">
        <span className="eyebrow">WELCOME TO EVENTSPHERE</span>

        <h1>
          Your campus. <span>Your community.</span>
        </h1>

        <p>Sign in to continue to your EventSphere account.</p>
      </div>

      <section
        className="form-panel login-panel"
        style={{
          maxWidth: "520px",
          margin: "0 auto"
        }}
      >
        <div className="form-panel-heading">
          <h2 style={{ textAlign: "center" }}>Welcome Back!</h2>

          <p style={{ textAlign: "center" }}>
            Choose your account type
          </p>
        </div>

        <div
          className="login-role-options"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "10px",
            margin: "22px 0"
          }}
        >
          {roles.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedRole(item.id);
                setError("");
                setPassword("");
              }}
              style={{
                padding: "16px 8px",
                borderRadius: "12px",
                border:
                  selectedRole === item.id
                    ? "2px solid #6758e8"
                    : "1px solid #dddddd",
                background:
                  selectedRole === item.id
                    ? "rgba(103, 88, 232, 0.10)"
                    : "transparent",
                color: "inherit",
                cursor: "pointer",
                fontWeight: selectedRole === item.id ? "700" : "500"
              }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: "25px",
                  marginBottom: "7px"
                }}
              >
                {item.icon}
              </span>

              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <form className="event-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email address *</label>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={
                selectedRole === "admin"
                  ? "Enter admin email"
                  : "23r11a0597@gcet.edu.in"
              }
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password *</label>

            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary form-submit"
            disabled={loading}
          >
            {loading ? "Please wait..." : "Login →"}
          </button>
        </form>

        {selectedRole !== "admin" ? (
          <p className="auth-switch" style={{ textAlign: "center" }}>
            Don't have an account?{" "}
            <Link to={`/register/${selectedRole}`}>
              Register
            </Link>
          </p>
        ) : (
          <p className="auth-switch" style={{ textAlign: "center" }}>
            Admin access only. Registration is disabled.
          </p>
        )}
      </section>
    </main>
  );
}

/* STUDENT AND COORDINATOR REGISTRATION */

function AuthPage({ mode, role }) {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";
  const isStudent = role === "student";

  const roleName = isStudent ? "Student" : "Event Coordinator";

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!isRegister) {
      navigate("/login", {
        replace: true,
        state: { role }
      });
      return;
    }

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (name.trim().length > 100) {
      setError("Name must not exceed 100 characters.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (isStudent) {
      const validationError = validateCollegeDetails(
        rollNumber,
        cleanEmail
      );

      if (validationError) {
        setError(validationError);
        return;
      }
    } else {
      const emailError = validateCollegeEmail(cleanEmail);

      if (emailError) {
        setError(emailError);
        return;
      }
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and re-entered password do not match.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        email: cleanEmail,
        password,
        role
      };

      if (isStudent) {
        payload.rollNumber = normalizeRollNumber(rollNumber);
      }

      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await readResponse(response);
      const account = data.account || data.student || data.user;

      if (!data.token || !account) {
        throw new Error(
          "The server returned incomplete account details."
        );
      }

      const savedAccount = {
        token: data.token,
        student: account,
        role
      };

      sessionStorage.setItem(
        STUDENT_STORAGE,
        JSON.stringify(savedAccount)
      );

      sessionStorage.removeItem(ADMIN_STORAGE);

      window.dispatchEvent(new Event("eventsphere-auth"));

      navigate(
        isStudent
          ? "/my-registrations"
          : "/coordinator/events",
        { replace: true }
      );
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  if (!isRegister) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ role }}
      />
    );
  }

  return (
    <main className="form-page">
      <div className="form-intro">
        <span className="eyebrow">
          EVENTSPHERE / {roleName.toUpperCase()}
        </span>

        <h1>
          Create your <span>account.</span>
        </h1>

        <p>
          Please provide name, email and password.
        </p>
      </div>

      <section className="form-panel">
        <div className="form-panel-heading">
          <h2>{roleName} registration</h2>
        </div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <form className="event-form" onSubmit={submit}>
          <div className="form-group">
            <label htmlFor="registerName">Full name *</label>

            <input
              id="registerName"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your full name"
              maxLength={100}
              autoComplete="name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="registerEmail">
              College email address *
            </label>

            <input
              id="registerEmail"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value.toLowerCase())}
              placeholder="23r11a0597@gcet.edu.in"
              autoComplete="email"
              required
            />

            <small>
              Use your official GCET email address.
            </small>
          </div>

          {isStudent && (
            <div className="form-group">
              <label htmlFor="registerRollNumber">
                College roll number *
              </label>

              <input
                id="registerRollNumber"
                type="text"
                value={rollNumber}
                onChange={e =>
                  setRollNumber(e.target.value.toUpperCase())
                }
                placeholder="23R11A0597"
                maxLength={10}
                autoComplete="off"
                required
              />

              <small>
                Your email must match your roll number.
              </small>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="registerPassword">Password *</label>

            <input
              id="registerPassword"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              placeholder="Enter password"
              autoComplete="new-password"
              required
            />

            <small>
              Password must contain at least 8 characters.
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              Re-enter password *
            </label>

            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              minLength={8}
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
            />
          </div>

          <button
            className="btn btn-primary form-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Register →"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login" state={{ role }}>
            Login
          </Link>
        </p>

        <p className="auth-switch">
          <Link to="/login">← Back to login options</Link>
        </p>
      </section>
    </main>
  );
}

/* MY REGISTRATIONS - STUDENT DASHBOARD */

function MyRegistrations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyRegistration, setBusyRegistration] = useState("");

  const student = getSavedStudent();
  const navigate = useNavigate();

  useEffect(() => {
    const role = getAccountRole(student);

    if (!student?.token || role !== "student") {
      navigate("/login", {
        replace: true,
        state: { role: "student" }
      });
      return;
    }

    const controller = new AbortController();

    fetch(`${API_URL}/my-registrations`, {
      headers: {
        Authorization: `Bearer ${student.token}`
      },
      signal: controller.signal
    })
      .then(readResponse)
      .then(data => {
        setItems(data.registrations || []);
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          setError(err.message || "Could not load registrations.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  async function cancelTicket(item) {
    const isOwner = Boolean(item.isOwnBooking);
    const confirmation = isOwner
      ? `Cancel your entire booking for "${item.event?.title || "this event"}"? This will cancel all ${item.seats || 1} remaining ticket(s) in this booking.`
      : `Cancel only your ticket for "${item.event?.title || "this event"}"? Other students' tickets will remain active.`;

    if (!window.confirm(confirmation)) return;

    setBusyRegistration(item._id);
    setError("");
    setMessage("");

    try {
      const endpoint = isOwner
        ? `${API_URL}/registrations/${item._id}`
        : `${API_URL}/registrations/${item._id}/my-ticket`;

      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${student.token}`
        }
      });

      const data = await readResponse(response);

      setItems(previous => previous.filter(registration =>
        registration._id !== item._id
      ));
      setMessage(data.message || "Ticket cancellation successful.");
    } catch (err) {
      setError(err.message || "Could not cancel ticket.");
    } finally {
      setBusyRegistration("");
    }
  }

  if (!student?.token || getAccountRole(student) !== "student") {
    return (
      <main className="form-page">
        <section className="form-panel">Opening student login...</section>
      </main>
    );
  }

  return (
    <main className="premium-events-page">
      <section className="section-container registrations-page">
        <span className="eyebrow">STUDENT DASHBOARD</span>

        <div className="form-success" role="status">
          {getWelcomeMessage(student)}
        </div>

        <h1>
          My <span>registrations.</span>
        </h1>

        <p className="premium-events-subtitle">
          Your event tickets and bookings.
        </p>

        <div style={{ margin: "20px 0" }}>
          <Link to="/events" className="btn btn-primary">
            Explore events ↗
          </Link>
        </div>

        {message && <div className="form-success" role="status">{message}</div>}
        {loading && <div className="premium-state">Loading your registrations...</div>}
        {error && <div className="form-error" role="alert">{error}</div>}

        {!loading && !error && items.length === 0 && (
          <div className="premium-empty-state">
            <h3>No registrations yet</h3>
            <p>Explore events and register for the ones you like.</p>
            <Link className="btn btn-primary" to="/events">Explore events</Link>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="premium-events-grid">
            {items.map(item => (
              <article className="registration-card" key={item._id}>
                <span className="registration-status">REGISTERED</span>
                <h3>{item.event?.title || "Event"}</h3>
                <p>{item.event?.description || ""}</p>

                <div className="premium-event-detail">
                  ▦ {formatDate(item.event?.date)} · {formatTime(item.event?.date)}
                </div>
                <div className="premium-event-detail">
                  ⌖ {item.event?.venue || "Venue TBA"}
                </div>

                {/* CANCELLATION DEADLINE */}
                <div
                  className="premium-event-detail"
                  style={{
                    color: isCancellationClosed(item.event?.date)
                      ? "#dc2626"
                      : "#16803c",
                    fontWeight: 600
                  }}
                >
                  ⏳{" "}
                  {isCancellationClosed(item.event?.date)
                    ? "Cancellation Closed"
                    : `Cancellation available until: ${formatDate(
                        getCancellationDeadline(item.event?.date)
                      )} · ${formatTime(
                        getCancellationDeadline(item.event?.date)
                      )}`}
                </div>

                {item.isOwnBooking ? (
                  <>
                    <div className="premium-event-detail">
                      ♧ Total tickets in your booking: {Number(item.seats || 1)}
                    </div>
                    <div className="registration-attendees">
                      <strong>All attendees in your booking</strong>
                      {(item.attendees || []).map((attendee, index) => (
                        <p key={`${attendee.rollNumber}-${index}`}>
                          {attendee.name} — {attendee.rollNumber}
                        </p>
                      ))}
                    </div>
                    <p className="premium-event-detail">
                      You created this booking.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="premium-event-detail">
                      Your ticket: {item.myTicket?.name} — {item.myTicket?.rollNumber}
                    </div>
                    <div className="premium-event-detail">
                      Booked by: {item.bookedBy?.name || "Student"} ({item.bookedBy?.rollNumber || "Roll number unavailable"})
                    </div>
                  </>
                )}

                {item.event?._id && (
                  <Link className="event-details-link" to={`/events/${item.event._id}`}>
                    View event ↗
                  </Link>
                )}

                <button
                  type="button"
                  className="btn btn-secondary form-submit"
                  disabled={
                    busyRegistration === item._id ||
                    isCancellationClosed(item.event?.date)
                  }
                  onClick={() => cancelTicket(item)}
                >
                  {busyRegistration === item._id
                    ? "Cancelling..."
                    : isCancellationClosed(item.event?.date)
                      ? "Cancellation Closed"
                      : item.isOwnBooking
                        ? "Cancel entire booking"
                        : "Cancel my ticket"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/* COORDINATOR DASHBOARD */

function CoordinatorEvents() {
  const account = getSavedStudent();
  const role = getAccountRole(account);

  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deletingEvent, setDeletingEvent] = useState("");

  async function deleteEvent(event) {
    if (!["Pending", "Rejected"].includes(event.status)) return;

    const confirmed = window.confirm(
      `Delete "${event.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingEvent(event._id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/coordinator/events/${event._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${account.token}`
          }
        }
      );

      const data = await readResponse(response);

      setEvents(previous =>
        previous.filter(item => item._id !== event._id)
      );

      setMessage(data.message || "Event deleted successfully.");
    } catch (err) {
      setError(err.message || "Could not delete event.");
    } finally {
      setDeletingEvent("");
    }
  }

  useEffect(() => {
    if (!account?.token || role !== "coordinator") {
      navigate("/login", {
        replace: true,
        state: { role: "coordinator" }
      });
      return;
    }

    const controller = new AbortController();

    fetch(`${API_URL}/coordinator/events`, {
      headers: {
        Authorization: `Bearer ${account.token}`
      },
      signal: controller.signal
    })
      .then(readResponse)
      .then(data => {
        setEvents(Array.isArray(data) ? data : data.events || []);
      })
      .catch(err => {
        if (err.name !== "AbortError") {
          setError(err.message || "Could not load your events.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  if (!account?.token || role !== "coordinator") {
    return (
      <main className="form-page">
        <section className="form-panel">
          Opening coordinator login...
        </section>
      </main>
    );
  }

  return (
    <main className="premium-events-page">
      <section className="section-container registrations-page">
        <span className="eyebrow">COORDINATOR DASHBOARD</span>

        <div className="form-success" role="status">
          {getWelcomeMessage(account)}
        </div>

        <h1>
          My <span>events.</span>
        </h1>

        <p className="premium-events-subtitle">
          Track the events you have submitted and their approval status.
        </p>

        {message && (
          <div className="form-success" role="status">
            {message}
          </div>
        )}

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div style={{ margin: "20px 0" }}>
          <Link to="/request-event" className="btn btn-primary">
            ＋ Create event
          </Link>
        </div>

        {loading && (
          <div className="premium-state">
            Loading your events...
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="premium-empty-state">
            <h3>You haven't submitted any events</h3>
            <p>Create your first campus event.</p>

            <Link
              to="/request-event"
              className="btn btn-primary"
            >
              Create event ↗
            </Link>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="premium-events-grid">
            {events.map(event => (
              <article
                className="registration-card"
                key={event._id}
              >
                <span className="registration-status">
                  {event.status || "Pending"}
                </span>

                {event.imageUrl && (
                  <img
                    src={getImageUrl(event.imageUrl)}
                    alt={event.title}
                    className="dashboard-event-image"
                  />
                )}

                <h3>{event.title}</h3>

                <p>{event.description}</p>

                <div className="premium-event-detail">
                  ▦ {formatDate(event.date)} · {formatTime(event.date)}
                </div>

                <div className="premium-event-detail">
                  ⌖ {event.venue}
                </div>

                <div className="premium-event-detail">
                  ♧ Total Registered: {getRegisteredCount(event)}
                </div>

                <div className="premium-event-detail">
                  ◉ Seats Available: {getAvailableSeats(event)}
                </div>

                <div className="premium-event-detail">
                  ▤ Maximum Capacity: {getMaxCapacity(event)}
                </div>

                <div className="premium-event-detail">
                  ☎ Coordinator Phone: {event.coordinatorPhone || "Not provided"}
                </div>

                {event.rejectionReason && (
                  <p className="form-error">
                    Reason: {event.rejectionReason}
                  </p>
                )}

                {event.status === "Approved" && (
                  <Link
                    className="event-details-link"
                    to={`/events/${event._id}`}
                  >
                    View event ↗
                  </Link>
                )}

                {["Pending", "Rejected"].includes(event.status) && (
                  <button
                    type="button"
                    className="btn btn-secondary form-submit"
                    disabled={deletingEvent === event._id}
                    onClick={() => deleteEvent(event)}
                  >
                    {deletingEvent === event._id
                      ? "Deleting..."
                      : "Delete event"}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

/* ADMIN DASHBOARD */

function Admin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(getSavedAdminToken());
  const [events, setEvents] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    let active = true;

    setLoading(true);

    fetch(`${API_URL}/admin/events/pending`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(readResponse)
      .then(data => {
        if (active) {
          setEvents(Array.isArray(data) ? data : data.events || []);
        }
      })
      .catch(err => {
        if (active) {
          setError(err.message || "Could not load pending events.");

          if (
            err.message?.toLowerCase().includes("token") ||
            err.message?.toLowerCase().includes("unauthorized")
          ) {
            sessionStorage.removeItem(ADMIN_STORAGE);
            setToken("");
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function handleLogin(e) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/admin/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await readResponse(response);

      if (!data.token) {
        throw new Error("Admin token was not returned.");
      }

      sessionStorage.setItem(ADMIN_STORAGE, data.token);
      sessionStorage.removeItem(STUDENT_STORAGE);

      setToken(data.token);
      setPassword("");
      setMessage("");

      window.dispatchEvent(new Event("eventsphere-auth"));
    } catch (err) {
      setError(err.message || "Admin login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function reviewEvent(eventId, action) {
    setError("");
    setMessage("");

    try {
      const options = {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      };

      if (action === "reject") {
        options.body = JSON.stringify({
          rejectionReason: reasons[eventId] || ""
        });
      }

      const response = await fetch(
        `${API_URL}/admin/events/${eventId}/${action}`,
        options
      );

      await readResponse(response);

      setEvents(previous =>
        previous.filter(item => item._id !== eventId)
      );

      setMessage(
        action === "approve"
          ? "Event approved."
          : "Event rejected."
      );
    } catch (err) {
      setError(err.message || "Could not update event.");
    }
  }

  function logout() {
    sessionStorage.removeItem(ADMIN_STORAGE);

    setToken("");
    setEvents([]);
    setEmail("");
    setPassword("");
    setMessage("");
    setError("");
    setReasons({});

    window.dispatchEvent(new Event("eventsphere-auth"));
  }

  return (
    <main className="form-page admin-page">
      <div className="form-intro">
        <span className="eyebrow">EVENTSPHERE</span>

        <h1>
          Admin <span>portal.</span>
        </h1>
      </div>

      <section className="form-panel admin-panel">
        {!token ? (
          <>
            <div className="form-panel-heading">
              <h2>Admin login</h2>
            </div>

            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleLogin} className="event-form">
              <div className="form-group">
                <label>Email</label>

                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <label>Password</label>

                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                className="btn btn-primary form-submit"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in ↗"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="admin-dashboard-heading">
              <div className="form-panel-heading">
                <h2>
                  Pending requests

                  <span className="admin-count-inline">
                    {events.length}
                  </span>
                </h2>
              </div>

              <button
                className="btn btn-secondary"
                onClick={logout}
              >
                Log out
              </button>
            </div>

            <div className="form-success" role="status">
              Welcome, Admin!
            </div>

            {message && <div className="form-success">{message}</div>}
            {error && <div className="form-error">{error}</div>}

            {loading ? (
              <div className="premium-state">
                Loading pending requests...
              </div>
            ) : !events.length ? (
              <div className="empty-state">
                <h3>All caught up!</h3>
                <p>No pending event requests.</p>
              </div>
            ) : (
              <div className="admin-events-list">
                {events.map(event => (
                  <article
                    className="admin-event-card"
                    key={event._id}
                  >
                    <div className="admin-event-top">
                      <span className="event-category-badge">
                        {event.category}
                      </span>

                      <span className="status-pending">
                        Pending
                      </span>
                    </div>

                    {event.imageUrl && (
                      <img
                        src={getImageUrl(event.imageUrl)}
                        alt={event.title}
                        className="dashboard-event-image"
                      />
                    )}

                    <h3>{event.title}</h3>

                    <p>{event.description}</p>

                    <div className="admin-event-details">
                      <span>📅 {formatDate(event.date)}</span>
                      <span>📍 {event.venue}</span>
                      <span>👤 {event.organizer}</span>
                      <span>👥 Maximum Capacity: {event.maxCapacity || 100}</span>
                      <span>☎ Coordinator Phone: {event.coordinatorPhone || "Not provided"}</span>
                      <span>Total Registered: {getRegisteredCount(event)}</span>
                      <span>Seats Available: {getAvailableSeats(event)}</span>
                    </div>

                    <div className="form-group">
                      <label>Rejection reason (optional)</label>

                      <textarea
                        value={reasons[event._id] || ""}
                        onChange={e =>
                          setReasons(previous => ({
                            ...previous,
                            [event._id]: e.target.value
                          }))
                        }
                        rows={2}
                        maxLength={500}
                      />
                    </div>

                    <div className="admin-event-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() =>
                          reviewEvent(event._id, "approve")
                        }
                      >
                        ✓ Approve
                      </button>

                      <button
                        className="btn btn-danger"
                        onClick={() =>
                          reviewEvent(event._id, "reject")
                        }
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

/* 404 PAGE */

function NotFound() {
  return (
    <main className="form-page">
      <section className="form-panel not-found">
        <span className="eyebrow">404</span>

        <h1>Page not found.</h1>

        <Link to="/login" className="btn btn-primary">
          Back to login
        </Link>
      </section>
    </main>
  );
}

/* SCROLL TO TOP */

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }, [pathname]);

  return null;
}

/* MAIN APP */

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <Navbar />

      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<AuthChoicePage />} />

        <Route path="/home" element={<Home />} />

        <Route path="/events" element={<Events />} />

        <Route path="/events/:id" element={<EventDetails />} />

        <Route
          path="/request-event"
          element={<RequestEvent />}
        />

        <Route
          path="/coordinator/events"
          element={<CoordinatorEvents />}
        />

        <Route path="/admin" element={<Admin />} />

        <Route
          path="/login/student"
          element={
            <Navigate
              to="/login"
              replace
              state={{ role: "student" }}
            />
          }
        />

        <Route
          path="/login/coordinator"
          element={
            <Navigate
              to="/login"
              replace
              state={{ role: "coordinator" }}
            />
          }
        />

        <Route
          path="/register/student"
          element={<AuthPage mode="register" role="student" />}
        />

        <Route
          path="/register/coordinator"
          element={<AuthPage mode="register" role="coordinator" />}
        />

        <Route
          path="/my-registrations"
          element={<MyRegistrations />}
        />

        <Route path="*" element={<NotFound />} />
      </Routes>

      <Footer />
    </BrowserRouter>
  );
}