import { Routes, Route } from "react-router-dom";

import VoiceControl from "./components/VoiceControl";

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
import PublicWorkshopPremium from "./pages/PublicWorkshopPremium";
import PublicWorkshopStandard from "./pages/PublicWorkshopStandard";
import PublicWorkshopRegistration from "./pages/PublicWorkshopRegistration";
import VerifyEmail from "./pages/VerifyEmail";
import VerificationSuccess from "./pages/VerificationSuccess";
import VerificationInvalid from "./pages/VerificationInvalid";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPasswordOtp from "./pages/ResetPasswordOtp";


import AdminDashboard from "./admin/AdminDashboard";
import AdminCalendar from "./admin/AdminCalendar";
import AdminContacts from "./admin/AdminContacts";
import AdminPayments from "./admin/AdminPayments";
import AdminReports from "./admin/AdminReports";
import AdminReservations from "./admin/AdminReservations";
import AdminWorkshopEdit from "./admin/AdminWorkshopEdit";
import AdminWorkshops from "./admin/AdminWorkshops";
import AdminForms from "./admin/AdminForms";
import AdminConcern from "./admin/AdminConcerns";

import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

function App() {
  return (
    <>
      {/* Global Voice & Theme Widget
        This stays on the screen across all pages
      */}
      <VoiceControl />

      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/event" element={<Event />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/day" element={<Day />} />
        <Route path="/reminder" element={<Reminder />} />
        <Route path="/private-workshop" element={<PrivateWorkshop />} />
        <Route path="/public-workshops" element={<WorkshopSignup />} />
        <Route path="/public-workshops/:id" element={<WorkshopView />} />
        <Route path="/public-workshops/:id/register" element={<WorkshopRegister />} />
        <Route path="/public-workshops/:id/standard" element={<PublicWorkshopStandard />} />
        <Route path="/public-workshops/:id/premium" element={<PublicWorkshopPremium />} />
        <Route path="/registration" element={<PublicWorkshopRegistration />} />

        {/* Auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verification-success" element={<VerificationSuccess />} />
        <Route path="/verification-invalid" element={<VerificationInvalid />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPasswordOtp />} />

        {/* Protected user routes */}
        <Route path="/add-booking" element={
            <ProtectedRoute>
              <AddEventBooking />
            </ProtectedRoute>
          }
        />

        <Route path="/profile" element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />

        <Route path="/my-concerns" element={
            <ProtectedRoute>
              <MyConcerns />
            </ProtectedRoute>
          }
        />

        <Route path="/report-concerns" element={
            <ProtectedRoute>
              <ReportConcerns />
            </ProtectedRoute>
          }
        />

        <Route path="/add-workshop-booking" element={
            <ProtectedRoute>
              <AddWorkshopBooking />
            </ProtectedRoute>
          }
        />

        <Route path="/gcash-payment" element={
            <ProtectedRoute>
              <GcashPayment />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route path="/admin/dashboard" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        <Route path="/admin/calendar" element={
            <AdminRoute>
              <AdminCalendar />
            </AdminRoute>
          }
        />

        <Route path="/admin/contacts" element={
            <AdminRoute>
              <AdminContacts />
            </AdminRoute>
          }
        />

        <Route path="/admin/payments" element={
            <AdminRoute>
              <AdminPayments />
            </AdminRoute>
          }
        />

        <Route path="/admin/reports" element={
            <AdminRoute>
              <AdminReports />
            </AdminRoute>
          }
        />

        <Route path="/admin/reservations" element={
            <AdminRoute>
              <AdminReservations />
            </AdminRoute>
          }
        />

        <Route path="/admin/workshops/edit/:id" element={
            <AdminRoute>
              <AdminWorkshopEdit />
            </AdminRoute>
          }
        />

        <Route path="/admin/workshops" element={
            <AdminRoute>
              <AdminWorkshops />
            </AdminRoute>
          }
        />

        <Route path="/admin/forms" element={
            <AdminRoute>
              <AdminForms />
            </AdminRoute>
          }
        />

        <Route path="/admin/concerns" element={
            <AdminRoute>
              <AdminConcern />
            </AdminRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;