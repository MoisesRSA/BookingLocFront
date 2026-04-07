import { LayoutDashboard, Calendar, LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

export default function Sidebar({ handleLogout }) {
  return (
    <aside className="glass-panel sidebar">
      <div className="sidebar-brand">
        <h2 className="gradient-text">BookingLoc</h2>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <LayoutDashboard size={20} />
          <span className="nav-label">Locais</span>
        </NavLink>
        <NavLink to="/my-bookings" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
          <Calendar size={20} />
          <span className="nav-label">Reservas</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button onClick={handleLogout} className="nav-item logout-btn">
          <LogOut size={20} />
          <span className="nav-label">Sair</span>
        </button>
      </div>
    </aside>
  );
}
