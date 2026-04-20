/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Employees from './pages/Employees';
import Branches from './pages/Branches';
import LeaveRequests from './pages/LeaveRequests';
import Reports from './pages/Reports';
import SystemSettings from './pages/SystemSettings';
import __Layout from './Layout.jsx';
import Login from './pages/Login';
import MobilePreview from './pages/MobilePreview';
import MobileHome from './pages/MobileHome';
import MobileCoordinates from './pages/MobileCoordinates';
import MobileWorkHours from './pages/MobileWorkHours';
import MobileHistory from './pages/MobileHistory';
import MobileProfile from './pages/MobileProfile';
import MobileLeave from './pages/MobileLeave';
import SuperAdmin from './pages/SuperAdmin';
import RegisterCompany from './pages/RegisterCompany';
import ResetTokens from './pages/ResetTokens';
import ChangePassword from './pages/ChangePassword';


export const PAGES = {
    "Dashboard": Dashboard,
    "Attendance": Attendance,
    "Employees": Employees,
    "Branches": Branches,
    "LeaveRequests": LeaveRequests,
    "Reports": Reports,
    "SystemSettings": SystemSettings,
    "Login": Login,
    "ChangePassword": ChangePassword,
    "MobilePreview": MobilePreview,
    "MobileHome": MobileHome,
    "MobileCoordinates": MobileCoordinates,
    "MobileLocations": MobileCoordinates,
    "MobileWorkHours": MobileWorkHours,
    "MobileHistory": MobileHistory,
    "MobileProfile": MobileProfile,
    "MobileLeave": MobileLeave,
    "SuperAdmin": SuperAdmin,
    "RegisterCompany": RegisterCompany,
    "ResetTokens": ResetTokens,
}

export const pagesConfig = {
    mainPage: "Login",
    Pages: PAGES,
    Layout: __Layout,
};
