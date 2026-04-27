import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import SignUp from "./pages/Sign-up";
import Home from "./pages/Home";
import About from "./pages/About";
import Event from "./pages/Event";
import Calendar from "./pages/Calendar";
import Day from "./pages/Day";
import Reminder from "./pages/Reminder";
import AddEventBooking from "./pages/AddEventBooking";
import UserProfile from "./pages/UserProfile";
import MyConcerns from "./pages/MyConcerns";
import ReportConcerns from "./pages/ReportConcerns";
import PrivateWorkshop from "./pages/PrivateWorkshop";
import AddWorkshopBooking from "./pages/AddWorkshopBooking";  
import WorkshopSignup from "./pages/WorkshopSignup";
import WorkshopView from "./pages/WorkshopView";
import WorkshopRegister from "./pages/WorkshopRegister";
import GcashPayment from "./pages/GcashPayment";
import AdminDashboard from "./admin/AdminDashboard";
import AdminCalendar from "./admin/AdminCalendar";
import AdminContacts from "./admin/AdminContacts";
import AdminPayments from "./admin/AdminPayments";
import AdminReports from "./admin/AdminReports";
import AdminReservations from "./admin/AdminReservations";
import AdminWorkshopEdit from "./admin/AdminWorkshopEdit";
import AdminWorkshops from "./admin/AdminWorkshops";
import PublicWorkshopPremium from "./pages/PublicWorkshopPremium";
import PublicWorkshopStandard from "./pages/PublicWorkshopStandard";
import AdminForms from "./admin/AdminForms";




function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/sign-up" element={<SignUp />} />
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/event" element={<Event />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/day" element={<Day />} />
      <Route path="/reminder" element={<Reminder />} />
      <Route path="/add-booking" element={<AddEventBooking />} />
      <Route path="/profile" element={<UserProfile />} />
      <Route path="/my-concerns" element={<MyConcerns />} />
      <Route path="/report-concerns" element={<ReportConcerns />} />
      <Route path="/private-workshop" element={<PrivateWorkshop />} />
      <Route path="/add-workshop-booking" element={<AddWorkshopBooking />} />
      <Route path="/public-workshops" element={<WorkshopSignup />} />
      <Route path="/public-workshops/:id" element={<WorkshopView />} />
      <Route path="/public-workshops/:id/register" element={<WorkshopRegister />} />
      <Route path="/gcash-payment" element={<GcashPayment />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/calendar" element={<AdminCalendar />} />
      <Route path="/admin/contacts" element={<AdminContacts />} />
      <Route path="/admin/payments" element={<AdminPayments />} />
      <Route path="/admin/reports" element={<AdminReports />} />
      <Route path="/admin/reservations" element={<AdminReservations />} />
      <Route path="/admin/workshops/edit/:id" element={<AdminWorkshopEdit />} />
      <Route path="/admin/workshops" element={<AdminWorkshops />} />
      <Route path="/public-workshops/:id/standard" element={<PublicWorkshopStandard />} />
      <Route path="/public-workshops/:id/premium" element={<PublicWorkshopPremium />} />
      <Route path="/admin/forms" element={<AdminForms />} />
    </Routes>
  );
}

export default App;