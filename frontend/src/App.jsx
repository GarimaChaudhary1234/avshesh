import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { isCollector, useAuth } from './lib/auth'
import Account from './pages/Account'
import ForgotPassword from './pages/ForgotPassword'
import Impact from './pages/Impact'
import Login from './pages/Login'
import Notifications from './pages/Notifications'
import Register from './pages/Register'
import Verify from './pages/Verify'
import CollectorDashboard from './pages/collector/Dashboard'
import Earnings from './pages/collector/Earnings'
import Pickups from './pages/collector/Pickups'
import Profile from './pages/collector/Profile'
import HouseholdHome from './pages/household/Home'
import MyListings from './pages/household/MyListings'
import NewListing from './pages/household/NewListing'
import Scan from './pages/household/Scan'
import Dealers from './pages/municipal/Dealers'
import StaffTasks from './pages/staff/Tasks'
import Officers from './pages/municipal/Officers'
import WardDetail from './pages/municipal/WardDetail'
import Wards from './pages/municipal/Wards'
import MunicipalOverview from './pages/municipal/Overview'
import Points from './pages/municipal/Points'
import Requests from './pages/municipal/Requests'
import Staff from './pages/municipal/Staff'

/** Sends logged-out visitors to /login; the role-specific pages are mounted below per role. */
function RequireAuth({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

function GuestOnly({ children }) {
  const { user } = useAuth()
  // A just-registered user has not proven their phone yet: send them straight to the code page.
  if (user) return <Navigate to={user.phoneVerified ? '/' : '/verify'} replace />
  return children
}

function HouseholdRoutes() {
  return (
    <>
      <Route index element={<HouseholdHome />} />
      <Route path="scan" element={<Scan />} />
      <Route path="list" element={<NewListing />} />
      <Route path="listings" element={<MyListings />} />
    </>
  )
}

function CollectorRoutes() {
  return (
    <>
      <Route index element={<CollectorDashboard />} />
      <Route path="pickups" element={<Pickups />} />
      <Route path="earnings" element={<Earnings />} />
      <Route path="profile" element={<Profile />} />
    </>
  )
}

function FieldStaffRoutes() {
  return <Route index element={<StaffTasks />} />
}

/** The ward and officer screens belong to the commissioner: anyone else is sent home. */
function CommissionerOnly({ children }) {
  const { user } = useAuth()
  return user.wardId == null ? children : <Navigate to="/" replace />
}

/** Pickup requests are handled by the officer of the ward, not by the commissioner. */
function WardOfficerOnly({ children }) {
  const { user } = useAuth()
  return user.wardId != null ? children : <Navigate to="/" replace />
}

function MunicipalRoutes() {
  return (
    <>
      <Route index element={<MunicipalOverview />} />
      <Route path="requests" element={<WardOfficerOnly><Requests /></WardOfficerOnly>} />
      <Route path="points" element={<Points />} />
      <Route path="dealers" element={<Dealers />} />
      <Route path="staff" element={<Staff />} />
      <Route path="wards" element={<CommissionerOnly><Wards /></CommissionerOnly>} />
      <Route path="wards/:id" element={<CommissionerOnly><WardDetail /></CommissionerOnly>} />
      <Route path="officers" element={<CommissionerOnly><Officers /></CommissionerOnly>} />
    </>
  )
}

/** The route set for a role. Called as a function: React Router needs <Route> elements as direct children. */
function routesFor(user) {
  if (!user) return null
  if (user.role === 'HOUSEHOLD') return HouseholdRoutes()
  if (user.role === 'MUNICIPAL') return MunicipalRoutes()
  if (user.role === 'FIELD_STAFF') return FieldStaffRoutes()
  return isCollector(user) ? CollectorRoutes() : null
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/forgot" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/impact" element={<Impact />} />

      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        {routesFor(user)}
        <Route path="verify" element={<Verify />} />
        <Route path="account" element={<Account />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>

      {/* Logged out, "/" matches nothing above, so unknown paths must go to /login (not "/") or it loops. */}
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  )
}
