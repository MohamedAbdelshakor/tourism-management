import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { BookingsListPage } from './pages/BookingsListPage';
import { BookingFormPage } from './pages/BookingFormPage';
import { BookingDetailPage } from './pages/BookingDetailPage';
import { ManageFieldsPage } from './pages/ManageFieldsPage';
import { VisasListPage } from './pages/VisasListPage';
import { VisaFormPage } from './pages/VisaFormPage';
import { VisaDetailPage } from './pages/VisaDetailPage';
import { VisaDestinationsPage } from './pages/VisaDestinationsPage';
import { VisaPapersPage } from './pages/VisaPapersPage';
import { RealEstatePage } from './pages/RealEstatePage';
import { ApartmentFormPage } from './pages/ApartmentFormPage';
import { ApartmentDetailPage } from './pages/ApartmentDetailPage';
import { ApartmentStatusesPage } from './pages/ApartmentStatusesPage';
import { AccountingPage } from './pages/AccountingPage';
import { UsersPage } from './pages/UsersPage';
import { EmployeeActivityPage } from './pages/EmployeeActivityPage';
import { PrintingPage } from './pages/PrintingPage';
import { PrintDocumentPage } from './pages/PrintDocumentPage';
import { DEPARTMENTS } from './types/domain';

const HomeRedirect: React.FC = () => {
  const { canView } = useAuth();
  const first = DEPARTMENTS.find((d) => canView(d.key));
  return <Navigate to={first?.path ?? '/domestic-bookings'} replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Standalone print view */}
          <Route
            path="/print/:kind/:id"
            element={
              <ProtectedRoute>
                <PrintDocumentPage />
              </ProtectedRoute>
            }
          />

          {/* Main authenticated layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomeRedirect />} />

            {/* Domestic Tourism */}
            <Route
              path="domestic-bookings"
              element={
                <ProtectedRoute department="domestic_tourism">
                  <BookingsListPage department="domestic_tourism" />
                </ProtectedRoute>
              }
            />
            <Route
              path="domestic-bookings/create"
              element={
                <ProtectedRoute department="domestic_tourism" requireEdit>
                  <BookingFormPage department="domestic_tourism" />
                </ProtectedRoute>
              }
            />
            <Route
              path="domestic-bookings/fields"
              element={
                <ProtectedRoute requireAdmin>
                  <ManageFieldsPage department="domestic_tourism" />
                </ProtectedRoute>
              }
            />
            <Route
              path="domestic-bookings/:id"
              element={
                <ProtectedRoute department="domestic_tourism">
                  <BookingDetailPage department="domestic_tourism" />
                </ProtectedRoute>
              }
            />
            <Route
              path="domestic-bookings/:id/edit"
              element={
                <ProtectedRoute department="domestic_tourism" requireEdit>
                  <BookingFormPage department="domestic_tourism" />
                </ProtectedRoute>
              }
            />

            {/* Outbound Tourism */}
            <Route
              path="outbound-bookings"
              element={
                <ProtectedRoute department="outbound_tourism">
                  <BookingsListPage department="outbound_tourism" />
                </ProtectedRoute>
              }
            />
            <Route
              path="outbound-bookings/create"
              element={
                <ProtectedRoute department="outbound_tourism" requireEdit>
                  <BookingFormPage department="outbound_tourism" />
                </ProtectedRoute>
              }
            />
            <Route
              path="outbound-bookings/fields"
              element={
                <ProtectedRoute requireAdmin>
                  <ManageFieldsPage department="outbound_tourism" />
                </ProtectedRoute>
              }
            />
            <Route
              path="outbound-bookings/:id"
              element={
                <ProtectedRoute department="outbound_tourism">
                  <BookingDetailPage department="outbound_tourism" />
                </ProtectedRoute>
              }
            />
            <Route
              path="outbound-bookings/:id/edit"
              element={
                <ProtectedRoute department="outbound_tourism" requireEdit>
                  <BookingFormPage department="outbound_tourism" />
                </ProtectedRoute>
              }
            />

            {/* Visas */}
            <Route
              path="visas"
              element={
                <ProtectedRoute department="visas">
                  <VisasListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="visas/create"
              element={
                <ProtectedRoute department="visas" requireEdit>
                  <VisaFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="visas/destinations"
              element={
                <ProtectedRoute requireAdmin>
                  <VisaDestinationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="visas/papers"
              element={
                <ProtectedRoute department="visas" requireEdit>
                  <VisaPapersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="visas/:id"
              element={
                <ProtectedRoute department="visas">
                  <VisaDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="visas/:id/edit"
              element={
                <ProtectedRoute department="visas" requireEdit>
                  <VisaFormPage />
                </ProtectedRoute>
              }
            />

            {/* Real Estate */}
            <Route
              path="real-estate"
              element={
                <ProtectedRoute department="real_estate">
                  <RealEstatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="real-estate/statuses"
              element={
                <ProtectedRoute department="real_estate" requireEdit>
                  <ApartmentStatusesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="real-estate/apartments/create"
              element={
                <ProtectedRoute department="real_estate" requireEdit>
                  <ApartmentFormPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="real-estate/apartments/:id"
              element={
                <ProtectedRoute department="real_estate">
                  <ApartmentDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="real-estate/apartments/:id/edit"
              element={
                <ProtectedRoute department="real_estate" requireEdit>
                  <ApartmentFormPage />
                </ProtectedRoute>
              }
            />

            {/* Accounting */}
            <Route
              path="accounting"
              element={
                <ProtectedRoute department="accounting">
                  <AccountingPage />
                </ProtectedRoute>
              }
            />

            {/* Users & Permissions */}
            <Route
              path="users"
              element={
                <ProtectedRoute department="users_permissions">
                  <UsersPage />
                </ProtectedRoute>
              }
            />

            {/* Employee Activity */}
            <Route
              path="employee-activity"
              element={
                <ProtectedRoute department="employee_activity">
                  <EmployeeActivityPage />
                </ProtectedRoute>
              }
            />

            {/* Printing */}
            <Route
              path="printing"
              element={
                <ProtectedRoute department="printing">
                  <PrintingPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
export default App;
