import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import {
  BarChart3,
  Clock,
  Package,
  PartyPopper,
  PhilippinePeso,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "@/assets/css/admin-dashboard.css";

/**
 * AdminDashboard.jsx
 */

const fmtMonth = (ym) => {
  const [year, month] = (ym || "").split("-");

  if (!year || !month) return ym;

  const d = new Date(Number(year), Number(month) - 1, 1);

  return d.toLocaleDateString("en-PH", {
    month: "short",
    year: "numeric",
  });
};

const money = (value) =>
  Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const readableLabel = (value = "") =>
  String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const COLORS = {
  green: "#37664c",
  greenDark: "#2f5a2b",
  greenLight: "rgba(55,102,76,0.15)",
  yellow: "#ffd95a",
  yellowStrong: "#f3c623",
  yellowLight: "rgba(255,217,90,0.28)",
  orange: "#e07b00",
  orangeLight: "rgba(224,123,0,0.16)",
  blue: "#2563eb",
  blueLight: "rgba(37,99,235,0.16)",
  red: "#dc2626",
  redLight: "rgba(220,38,38,0.16)",
  gray: "#6b7a62",
  grayLight: "rgba(107,122,98,0.16)",
};

const STATUS_COLORS = {
  pending_payment: COLORS.orange,
  pending: COLORS.blue,
  approved: COLORS.green,
  completed: COLORS.greenDark,
  cancelled: COLORS.gray,
  rejected: COLORS.red,
  unpaid: COLORS.gray,
  partial: COLORS.orange,
  paid: COLORS.green,
};

function SkeletonCard() {
  return (
    <div className="admin-card-react admin-card-feature-react dash-skeleton">
      <div className="skel-line skel-short" />
      <div className="skel-line skel-tall" />
      <div className="skel-line skel-medium" />
    </div>
  );
}

function StatCard({ icon: Icon, label, tag, value, sub, accent }) {
  return (
    <div
      className="admin-card-react admin-card-feature-react"
      style={accent ? { borderLeft: `4px solid ${accent}` } : {}}
    >
      <div className="admin-card-label-react">
        <Icon size={14} aria-hidden="true" />
        <span>{tag}</span>
      </div>

      <h4>{label}</h4>

      <div className="admin-big-react">{value}</div>

      <div className="admin-muted-react">{sub}</div>
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="dash-empty-chart">
      <div className="dash-empty-icon" aria-hidden="true">
        <BarChart3 size={34} strokeWidth={2.2} />
      </div>
      <div className="dash-empty-msg">{message}</div>
    </div>
  );
}

function hasAnyNumber(values = []) {
  return values.some((value) => Number(value || 0) > 0);
}

function ChartBox({ title, subtitle, loading, emptyMessage, hasData, children }) {
  return (
    <div className="admin-panel-react">
      <h3 style={{ marginBottom: 4 }}>{title}</h3>

      {subtitle && (
        <p
          className="admin-muted-react"
          style={{ marginTop: 0, marginBottom: 14, fontSize: "0.86rem" }}
        >
          {subtitle}
        </p>
      )}

      {loading ? (
        <div className="admin-muted-react" role="status">
          Loading chart…
        </div>
      ) : !hasData ? (
        <EmptyChart message={emptyMessage} />
      ) : (
        <div style={{ position: "relative", minHeight: 280 }}>{children}</div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const bookingCanvasRef = useRef(null);
  const revenueCanvasRef = useRef(null);
  const statusCanvasRef = useRef(null);
  const paymentCanvasRef = useRef(null);

  const bookingChartRef = useRef(null);
  const revenueChartRef = useRef(null);
  const statusChartRef = useRef(null);
  const paymentChartRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const { data } = await adminApi.get("/admin/admin-dashboard.php");

        const labels = (data.labels || []).map(fmtMonth);

        setStats({
          totalWorkshop: Number(data.totalWorkshop || data.totalPrivateWorkshops || 0),
          totalPrivateWorkshops: Number(
            data.totalPrivateWorkshops || data.totalWorkshop || 0
          ),
          totalEvent: Number(data.totalEvent || 0),
          totalPublicRegistrations: Number(data.totalPublicRegistrations || 0),

          totalRevenue: Number(data.totalRevenue || 0),
          paidBookings: Number(data.paidBookings || 0),

          pendingBookings: Number(data.pendingBookings || 0),
          pendingPaymentBookings: Number(data.pendingPaymentBookings || 0),
          cancellationRequests: Number(data.cancellationRequests || 0),

          labels,

          workshopCounts: (data.workshopCounts || data.privateWorkshopCounts || []).map(
            Number
          ),
          privateWorkshopCounts: (
            data.privateWorkshopCounts ||
            data.workshopCounts ||
            []
          ).map(Number),
          eventCounts: (data.eventCounts || []).map(Number),
          publicRegistrationCounts: (data.publicRegistrationCounts || []).map(
            Number
          ),
          pendingCounts: (data.pendingCounts || []).map(Number),

          revenue: (data.revenue || []).map(Number),
          paymentCounts: (data.paymentCounts || []).map(Number),

          statusLabels: (data.statusLabels || []).map(readableLabel),
          statusRawLabels: data.statusLabels || [],
          statusCounts: (data.statusCounts || []).map(Number),

          paymentStatusLabels: (data.paymentStatusLabels || []).map(readableLabel),
          paymentStatusRawLabels: data.paymentStatusLabels || [],
          paymentStatusCounts: (data.paymentStatusCounts || []).map(Number),
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard data. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!stats || !stats.labels.length) return;

    bookingChartRef.current?.destroy();
    revenueChartRef.current?.destroy();
    statusChartRef.current?.destroy();
    paymentChartRef.current?.destroy();

    const frame = requestAnimationFrame(() => {
      const bookingCtx = bookingCanvasRef.current?.getContext("2d");
      const revenueCtx = revenueCanvasRef.current?.getContext("2d");
      const statusCtx = statusCanvasRef.current?.getContext("2d");
      const paymentCtx = paymentCanvasRef.current?.getContext("2d");

      if (bookingCtx) {
        bookingChartRef.current = new Chart(bookingCtx, {
          type: "bar",
          data: {
            labels: stats.labels,
            datasets: [
              {
                label: "Events",
                data: stats.eventCounts,
                backgroundColor: COLORS.yellow,
                borderRadius: 6,
              },
              {
                label: "Private Workshops",
                data: stats.privateWorkshopCounts,
                backgroundColor: COLORS.green,
                borderRadius: 6,
              },
              {
                label: "Public Registrations",
                data: stats.publicRegistrationCounts,
                backgroundColor: COLORS.blue,
                borderRadius: 6,
              },
              {
                label: "Pending / Awaiting Payment",
                data: stats.pendingCounts,
                backgroundColor: COLORS.orange,
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: "index",
              intersect: false,
            },
            plugins: {
              legend: {
                position: "bottom",
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}`,
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  precision: 0,
                  color: COLORS.gray,
                },
                grid: {
                  color: "rgba(0,0,0,0.05)",
                },
              },
              x: {
                ticks: {
                  color: COLORS.gray,
                  maxRotation: 45,
                },
                grid: {
                  display: false,
                },
              },
            },
          },
        });
      }

      if (revenueCtx) {
        revenueChartRef.current = new Chart(revenueCtx, {
          type: "line",
          data: {
            labels: stats.labels,
            datasets: [
              {
                label: "Revenue",
                data: stats.revenue,
                borderColor: COLORS.green,
                backgroundColor: COLORS.greenLight,
                tension: 0.35,
                fill: true,
                pointBackgroundColor: COLORS.green,
                pointRadius: 4,
                yAxisID: "y",
              },
              {
                label: "Paid Payments",
                data: stats.paymentCounts,
                borderColor: COLORS.orange,
                backgroundColor: COLORS.orangeLight,
                tension: 0.35,
                fill: false,
                pointBackgroundColor: COLORS.orange,
                pointRadius: 4,
                yAxisID: "y1",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: "index",
              intersect: false,
            },
            plugins: {
              legend: {
                position: "bottom",
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    if (ctx.dataset.label === "Revenue") {
                      return ` Revenue: ₱${money(ctx.raw)}`;
                    }

                    return ` Paid Payments: ${ctx.raw}`;
                  },
                },
              },
            },
            scales: {
              y: {
                type: "linear",
                position: "left",
                beginAtZero: true,
                ticks: {
                  color: COLORS.gray,
                  callback: (value) => `₱${Number(value).toLocaleString("en-PH")}`,
                },
                grid: {
                  color: "rgba(0,0,0,0.05)",
                },
              },
              y1: {
                type: "linear",
                position: "right",
                beginAtZero: true,
                ticks: {
                  precision: 0,
                  color: COLORS.gray,
                },
                grid: {
                  drawOnChartArea: false,
                },
              },
              x: {
                ticks: {
                  color: COLORS.gray,
                  maxRotation: 45,
                },
                grid: {
                  display: false,
                },
              },
            },
          },
        });
      }

      if (statusCtx) {
        statusChartRef.current = new Chart(statusCtx, {
          type: "doughnut",
          data: {
            labels: stats.statusLabels,
            datasets: [
              {
                label: "Bookings",
                data: stats.statusCounts,
                backgroundColor: stats.statusRawLabels.map(
                  (label) => STATUS_COLORS[label] || COLORS.gray
                ),
                borderWidth: 2,
                borderColor: "#ffffff",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
              legend: {
                position: "bottom",
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.label}: ${ctx.raw}`,
                },
              },
            },
          },
        });
      }

      if (paymentCtx) {
        paymentChartRef.current = new Chart(paymentCtx, {
          type: "doughnut",
          data: {
            labels: stats.paymentStatusLabels,
            datasets: [
              {
                label: "Payments",
                data: stats.paymentStatusCounts,
                backgroundColor: stats.paymentStatusRawLabels.map(
                  (label) => STATUS_COLORS[label] || COLORS.gray
                ),
                borderWidth: 2,
                borderColor: "#ffffff",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
              legend: {
                position: "bottom",
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.label}: ${ctx.raw}`,
                },
              },
            },
          },
        });
      }
    });

    return () => {
      cancelAnimationFrame(frame);

      bookingChartRef.current?.destroy();
      revenueChartRef.current?.destroy();
      statusChartRef.current?.destroy();
      paymentChartRef.current?.destroy();

      bookingChartRef.current = null;
      revenueChartRef.current = null;
      statusChartRef.current = null;
      paymentChartRef.current = null;
    };
  }, [stats]);

  const avgRevenuePerPaidBooking =
    stats && stats.paidBookings > 0
      ? stats.totalRevenue / stats.paidBookings
      : 0;

  const totalMeaningfulBookings =
    Number(stats?.totalEvent || 0) +
    Number(stats?.totalPrivateWorkshops || 0) +
    Number(stats?.totalPublicRegistrations || 0);

  const totalActionRequired =
    Number(stats?.pendingBookings || 0) +
    Number(stats?.pendingPaymentBookings || 0) +
    Number(stats?.cancellationRequests || 0);

  const hasBookingChartData =
    stats &&
    (hasAnyNumber(stats.eventCounts) ||
      hasAnyNumber(stats.privateWorkshopCounts) ||
      hasAnyNumber(stats.publicRegistrationCounts) ||
      hasAnyNumber(stats.pendingCounts));

  const hasRevenueChartData =
    stats && (hasAnyNumber(stats.revenue) || hasAnyNumber(stats.paymentCounts));

  const hasStatusChartData = stats && hasAnyNumber(stats.statusCounts);
  const hasPaymentStatusChartData = stats && hasAnyNumber(stats.paymentStatusCounts);

  const bestRevenueMonth = useMemo(() => {
    if (!stats || !stats.revenue.length) return "—";

    const max = Math.max(...stats.revenue);

    if (max <= 0) return "—";

    const index = stats.revenue.indexOf(max);

    return `${stats.labels[index]} — ₱${money(max)}`;
  }, [stats]);

  return (
    <AdminLayout title="Dashboard">
      {error && (
        <div className="admin-notice-react bad" role="alert">
          {error}
        </div>
      )}

      <div
        className="admin-cards-react admin-cards-hero-react"
        style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}
      >
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              icon={PartyPopper}
              tag="Events"
              label="Total Events"
              value={stats?.totalEvent ?? 0}
              sub="Approved & completed"
            />

            <StatCard
              icon={Package}
              tag="Private Workshops"
              label="Total Workshops"
              value={stats?.totalPrivateWorkshops ?? 0}
              sub="Approved & completed"
            />

            <StatCard
              icon={PhilippinePeso}
              tag="Revenue"
              label="Total Revenue"
              value={`₱${money(stats?.totalRevenue ?? 0)}`}
              sub="Paid GCash payments"
            />

            <StatCard
              icon={Clock}
              tag="Action Required"
              label="Needs Review"
              value={totalActionRequired}
              sub="Pending, unpaid, or cancel requests"
              accent={totalActionRequired > 0 ? COLORS.orange : undefined}
            />
          </>
        )}
      </div>

      <div className="admin-grid-2-react">
        <ChartBox
          title="Booking Trends"
          subtitle="Events, private workshops, public registrations, and pending bookings by month."
          loading={loading}
          hasData={hasBookingChartData}
          emptyMessage="No booking data for the past 12 months yet."
        >
          <canvas ref={bookingCanvasRef} aria-label="Booking trends chart" />
        </ChartBox>

        <ChartBox
          title="Revenue & Paid Payments"
          subtitle="Revenue amount and number of paid payment submissions by month."
          loading={loading}
          hasData={hasRevenueChartData}
          emptyMessage="No paid payment data for the past 12 months yet."
        >
          <canvas ref={revenueCanvasRef} aria-label="Revenue and paid payments chart" />
        </ChartBox>
      </div>

      <div className="admin-grid-2-react">
        <ChartBox
          title="Booking Status Distribution"
          subtitle="Current status of all booking records."
          loading={loading}
          hasData={hasStatusChartData}
          emptyMessage="No booking status data available yet."
        >
          <canvas ref={statusCanvasRef} aria-label="Booking status distribution chart" />
        </ChartBox>

        <ChartBox
          title="Payment Status Distribution"
          subtitle="Computed payment state from bookings, payments, and workshop registrations."
          loading={loading}
          hasData={hasPaymentStatusChartData}
          emptyMessage="No payment status data available yet."
        >
          <canvas ref={paymentCanvasRef} aria-label="Payment status distribution chart" />
        </ChartBox>
      </div>

      <div className="admin-grid-3-react">
        <div className="admin-panel-react">
          <h3>Quick Insights</h3>

          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Avg revenue / paid record</span>
              <strong>₱{money(avgRevenuePerPaidBooking)}</strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Best revenue month</span>
              <strong>{bestRevenueMonth}</strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Months tracked</span>
              <strong>{stats?.labels.length ?? "—"}</strong>
            </div>
          </div>
        </div>

        <div className="admin-panel-react">
          <h3>Bookings Snapshot</h3>

          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Meaningful bookings</span>
              <strong>{loading ? "—" : totalMeaningfulBookings}</strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Public workshop registrations</span>
              <strong>{stats?.totalPublicRegistrations ?? "—"}</strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Cancellation requests</span>
              <strong
                style={{
                  color: stats?.cancellationRequests > 0 ? COLORS.orange : "inherit",
                }}
              >
                {stats?.cancellationRequests ?? "—"}
              </strong>
            </div>
          </div>
        </div>

        <div className="admin-panel-react">
          <h3>System Status</h3>

          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Dashboard API</span>
              <strong style={{ color: error ? COLORS.red : COLORS.green }}>
                {error ? "Error" : loading ? "Loading…" : "Online"}
              </strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Charts</span>
              <strong>
                {loading
                  ? "Loading…"
                  : hasBookingChartData || hasRevenueChartData
                  ? "Ready"
                  : "No data"}
              </strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Data source</span>
              <strong>Bookings / Payments</strong>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}