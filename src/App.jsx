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
    </Routes>
  );
}

export default App;