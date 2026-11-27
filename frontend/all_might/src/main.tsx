import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/home/Home'
import Status from './pages/status/Status'
import Login from './pages/login/Login'
import ResetPassword from './pages/resetpassword/resetPassword'
import Outlet from './outlet'
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import PageGuard from './components/pageGuard/pageGuard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Each page declares the permission the API demands of the routes
            behind it, so someone without it gets an explanation instead of a
            screen that loads and then fails request by request. */}
        <Route path="/" element={<Outlet />}>
          <Route index element={<PageGuard permission="page:integracao"><Home /></PageGuard>} />
          <Route path="status" element={<PageGuard permission="page:status"><Status /></PageGuard>} />
          <Route path="login" element={<Login />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

const app = createRoot(document.getElementById('root')!)

app.render(
  <StrictMode>
    <App />
  </StrictMode>,
)