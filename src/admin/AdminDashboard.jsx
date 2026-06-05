import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Chart from "chart.js/auto";
import {
  AlertCircle,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HandCoins,
  Package,
  PartyPopper,
  PhilippinePeso,
  RefreshCw,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";
import "@/assets/css/admin-dashboard.css";

/**
 * AdminDashboard.jsx
 */

const EMPTY_LABELS = [];
const EMPTY_RAW_LABELS = [];
const EMPTY_VALUES = [];

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
  complete: COLORS.greenDark,
  cancelled: COLORS.gray,
  canceled: COLORS.gray,
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
      className="admin-card-react admin-card-feature-react dash-stat-card"
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

function hasAnyNumber(values = EMPTY_VALUES) {
  return values.some((value) => Number(value || 0) > 0);
}

function ChartBox({
  title,
  subtitle,
  loading,
  emptyMessage,
  hasData,
  chartType = "standard",
  children,
}) {
  return (
    <div className={`admin-panel-react dash-chart-card dash-chart-card-${chartType}`}>
      <div className="dash-panel-title-row">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="admin-muted-react">{subtitle}</p>}
        </div>
      </div>

      {loading ? (
        <div className="admin-muted-react dash-chart-loading" role="status">
          Loading chart…
        </div>
      ) : !hasData ? (
        <EmptyChart message={emptyMessage} />
      ) : (
        <div className={`dash-chart-wrap dash-chart-wrap-${chartType}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function ActionSummary({
  loading,
  pendingBookings,
  pendingPayments,
  cancellations,
  pendingRefunds,
}) {
  const total =
    Number(pendingBookings || 0) +
    Number(pendingPayments || 0) +
    Number(cancellations || 0) +
    Number(pendingRefunds || 0);

  if (loading) {
    return (
      <div className="dash-action-panel dash-action-panel-loading">
        <div className="skel-line skel-short" />
        <div className="skel-line skel-medium" />
      </div>
    );
  }

  if (total <= 0) {
    return (
      <div className="dash-action-panel dash-action-panel-ok">
        <div className="dash-action-icon dash-action-icon-ok">
          <CheckCircle2 size={20} aria-hidden="true" />
        </div>
        <div>
          <strong>No urgent admin action right now.</strong>
          <span>
            Pending bookings, payment reviews, cancellation requests, and refund
            requests are clear.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-action-panel dash-action-panel-warning">
      <div className="dash-action-icon dash-action-icon-warning">
        <AlertCircle size={20} aria-hidden="true" />
      </div>

      <div className="dash-action-content">
        <strong>
          {total} item{total === 1 ? "" : "s"} need admin review
        </strong>
        <span>
          {pendingBookings} booking{pendingBookings === 1 ? "" : "s"},{" "}
          {pendingPayments} payment{pendingPayments === 1 ? "" : "s"},{" "}
          {cancellations} cancellation request{cancellations === 1 ? "" : "s"},
          and {pendingRefunds} refund request{pendingRefunds === 1 ? "" : "s"}.
        </span>
      </div>

      <div className="dash-action-links" aria-label="Dashboard action links">
        <Link to="/admin/reservations">Review Bookings</Link>
        <Link to="/admin/payments">Check Payments</Link>
        <Link to="/admin/refunds">Review Refunds</Link>
      </div>
    </div>
  );
}

function StatusList({
  labels = EMPTY_LABELS,
  rawLabels = EMPTY_RAW_LABELS,
  values = EMPTY_VALUES,
}) {
  const total = values.reduce((sum, value) => sum + Number(value || 0), 0);

  return (
    <div className="dash-status-list">
      {labels.map((label, index) => {
        const value = Number(values[index] || 0);
        const raw = rawLabels[index];
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        const color = STATUS_COLORS[raw] || COLORS.gray;

        return (
          <div className="dash-status-row" key={raw || label}>
            <div className="dash-status-main">
              <span className="dash-status-dot" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>

            <div className="dash-status-value">
              <strong>{value}</strong>
              <span>{percent}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [error, setError] = useState("");

  const loading = loadStatus === "loading";

  const bookingCanvasRef = useRef(null);
  const revenueCanvasRef = useRef(null);
  const statusCanvasRef = useRef(null);
  const paymentCanvasRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await adminApi.get("/admin/admin-dashboard.php");

        const labels = (data.labels || EMPTY_LABELS).map(fmtMonth);

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

          pendingRefundRequests: Number(data.pendingRefundRequests || 0),
          approvedRefundRequests: Number(data.approvedRefundRequests || 0),
          rejectedRefundRequests: Number(data.rejectedRefundRequests || 0),
          totalRefundRequests: Number(data.totalRefundRequests || 0),
          approvedRefundAmount: Number(data.approvedRefundAmount || 0),
          pendingRefundAmount: Number(data.pendingRefundAmount || 0),

          labels,

          workshopCounts: (
            data.workshopCounts ||
            data.privateWorkshopCounts ||
            EMPTY_VALUES
          ).map(Number),
          privateWorkshopCounts: (
            data.privateWorkshopCounts ||
            data.workshopCounts ||
            EMPTY_VALUES
          ).map(Number),
          eventCounts: (data.eventCounts || EMPTY_VALUES).map(Number),
          publicRegistrationCounts: (
            data.publicRegistrationCounts || EMPTY_VALUES
          ).map(Number),
          pendingCounts: (data.pendingCounts || EMPTY_VALUES).map(Number),

          revenue: (data.revenue || EMPTY_VALUES).map(Number),
          paymentCounts: (data.paymentCounts || EMPTY_VALUES).map(Number),

          statusLabels: (data.statusLabels || EMPTY_LABELS).map(readableLabel),
          statusRawLabels: data.statusLabels || EMPTY_RAW_LABELS,
          statusCounts: (data.statusCounts || EMPTY_VALUES).map(Number),

          paymentStatusLabels: (data.paymentStatusLabels || EMPTY_LABELS).map(
            readableLabel
          ),
          paymentStatusRawLabels: data.paymentStatusLabels || EMPTY_RAW_LABELS,
          paymentStatusCounts: (data.paymentStatusCounts || EMPTY_VALUES).map(
            Number
          ),
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard data. Please refresh the page.");
      } finally {
        setLoadStatus("loaded");
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!stats || !stats.labels.length) return;

    let bookingChart = null;
    let revenueChart = null;
    let statusChart = null;
    let paymentChart = null;

    const sharedLegend = {
      position: "bottom",
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        pointStyle: "circle",
        padding: 14,
      },
    };

    const frame = requestAnimationFrame(() => {
      const bookingCtx = bookingCanvasRef.current?.getContext("2d");
      const revenueCtx = revenueCanvasRef.current?.getContext("2d");
      const statusCtx = statusCanvasRef.current?.getContext("2d");
      const paymentCtx = paymentCanvasRef.current?.getContext("2d");

      if (bookingCtx) {
        bookingChart = new Chart(bookingCtx, {
          type: "bar",
          data: {
            labels: stats.labels,
            datasets: [
              {
                label: "Events",
                data: stats.eventCounts,
                backgroundColor: COLORS.yellow,
                borderRadius: 7,
                maxBarThickness: 34,
              },
              {
                label: "Private Workshops",
                data: stats.privateWorkshopCounts,
                backgroundColor: COLORS.green,
                borderRadius: 7,
                maxBarThickness: 34,
              },
              {
                label: "Public Registrations",
                data: stats.publicRegistrationCounts,
                backgroundColor: COLORS.blue,
                borderRadius: 7,
                maxBarThickness: 34,
              },
              {
                label: "Needs Review",
                data: stats.pendingCounts,
                backgroundColor: COLORS.orange,
                borderRadius: 7,
                maxBarThickness: 34,
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
              legend: sharedLegend,
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
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 6,
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
        revenueChart = new Chart(revenueCtx, {
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
                pointRadius: 3,
                pointHoverRadius: 5,
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
                pointRadius: 3,
                pointHoverRadius: 5,
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
              legend: sharedLegend,
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
                  maxTicksLimit: 5,
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
                  maxTicksLimit: 5,
                },
                grid: {
                  drawOnChartArea: false,
                },
              },
              x: {
                ticks: {
                  color: COLORS.gray,
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 6,
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
        statusChart = new Chart(statusCtx, {
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
                hoverOffset: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "72%",
            radius: "82%",
            plugins: {
              legend: {
                display: false,
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
        paymentChart = new Chart(paymentCtx, {
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
                hoverOffset: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "72%",
            radius: "82%",
            plugins: {
              legend: {
                display: false,
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

      bookingChart?.destroy();
      revenueChart?.destroy();
      statusChart?.destroy();
      paymentChart?.destroy();
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
    Number(stats?.cancellationRequests || 0) +
    Number(stats?.pendingRefundRequests || 0);

  const hasBookingChartData =
    stats &&
    (hasAnyNumber(stats.eventCounts) ||
      hasAnyNumber(stats.privateWorkshopCounts) ||
      hasAnyNumber(stats.publicRegistrationCounts) ||
      hasAnyNumber(stats.pendingCounts));

  const hasRevenueChartData =
    stats && (hasAnyNumber(stats.revenue) || hasAnyNumber(stats.paymentCounts));

  const hasStatusChartData = stats && hasAnyNumber(stats.statusCounts);
  const hasPaymentStatusChartData =
    stats && hasAnyNumber(stats.paymentStatusCounts);

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

      <ActionSummary
        loading={loading}
        pendingBookings={stats?.pendingBookings ?? 0}
        pendingPayments={stats?.pendingPaymentBookings ?? 0}
        cancellations={stats?.cancellationRequests ?? 0}
        pendingRefunds={stats?.pendingRefundRequests ?? 0}
      />

      <div className="admin-cards-react admin-cards-hero-react">
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
              sub="Approved and completed"
            />

            <StatCard
              icon={Package}
              tag="Private Workshops"
              label="Total Workshops"
              value={stats?.totalPrivateWorkshops ?? 0}
              sub="Approved and completed"
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
              sub="Bookings, payments, cancellations, refunds"
              accent={totalActionRequired > 0 ? COLORS.orange : undefined}
            />
          </>
        )}
      </div>

      <div className="admin-cards-react admin-cards-hero-react">
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
              icon={HandCoins}
              tag="Refunds"
              label="Pending Refunds"
              value={stats?.pendingRefundRequests ?? 0}
              sub={`Pending amount: ₱${money(stats?.pendingRefundAmount ?? 0)}`}
              accent={
                Number(stats?.pendingRefundRequests || 0) > 0
                  ? COLORS.orange
                  : undefined
              }
            />

            <StatCard
              icon={CheckCircle2}
              tag="Approved Refunds"
              label="Approved"
              value={stats?.approvedRefundRequests ?? 0}
              sub={`Approved amount: ₱${money(stats?.approvedRefundAmount ?? 0)}`}
              accent={COLORS.green}
            />

            <StatCard
              icon={AlertCircle}
              tag="Rejected Refunds"
              label="Rejected"
              value={stats?.rejectedRefundRequests ?? 0}
              sub="Rejected refund requests"
              accent={
                Number(stats?.rejectedRefundRequests || 0) > 0
                  ? COLORS.red
                  : undefined
              }
            />

            <StatCard
              icon={HandCoins}
              tag="Total Refunds"
              label="All Requests"
              value={stats?.totalRefundRequests ?? 0}
              sub="All refund request records"
            />
          </>
        )}
      </div>

      <div className="admin-grid-2-react dash-main-chart-grid">
        <ChartBox
          title="Booking Trends"
          subtitle="Monthly bookings grouped by type and pending status."
          loading={loading}
          hasData={hasBookingChartData}
          emptyMessage="No booking data for the past 12 months yet."
        >
          <canvas ref={bookingCanvasRef} aria-label="Booking trends chart" />
        </ChartBox>

        <ChartBox
          title="Revenue and Paid Payments"
          subtitle="Paid revenue and verified payment count by month."
          loading={loading}
          hasData={hasRevenueChartData}
          emptyMessage="No paid payment data for the past 12 months yet."
        >
          <canvas
            ref={revenueCanvasRef}
            aria-label="Revenue and paid payments chart"
          />
        </ChartBox>
      </div>

      <div className="admin-grid-2-react dash-status-grid">
        <ChartBox
          title="Booking Status"
          subtitle="Current booking state. Use this to spot backlogs quickly."
          loading={loading}
          chartType="compact"
          hasData={hasStatusChartData}
          emptyMessage="No booking status data available yet."
        >
          <canvas
            ref={statusCanvasRef}
            aria-label="Booking status distribution chart"
          />
          <StatusList
            labels={stats?.statusLabels}
            rawLabels={stats?.statusRawLabels}
            values={stats?.statusCounts}
          />
        </ChartBox>

        <ChartBox
          title="Payment Status"
          subtitle="Payment state from bookings, payments, and public registrations."
          loading={loading}
          chartType="compact"
          hasData={hasPaymentStatusChartData}
          emptyMessage="No payment status data available yet."
        >
          <canvas
            ref={paymentCanvasRef}
            aria-label="Payment status distribution chart"
          />
          <StatusList
            labels={stats?.paymentStatusLabels}
            rawLabels={stats?.paymentStatusRawLabels}
            values={stats?.paymentStatusCounts}
          />
        </ChartBox>
      </div>

      <div className="admin-grid-3-react dash-insight-grid">
        <div className="admin-panel-react dash-info-panel">
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

        <div className="admin-panel-react dash-info-panel">
          <h3>Bookings Snapshot</h3>

          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Confirmed business records</span>
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

        <div className="admin-panel-react dash-info-panel">
          <h3>Refund Snapshot</h3>

          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Pending refund requests</span>
              <strong
                style={{
                  color:
                    Number(stats?.pendingRefundRequests || 0) > 0
                      ? COLORS.orange
                      : "inherit",
                }}
              >
                {stats?.pendingRefundRequests ?? "—"}
              </strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Pending refund amount</span>
              <strong>₱{money(stats?.pendingRefundAmount ?? 0)}</strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Approved refund amount</span>
              <strong>₱{money(stats?.approvedRefundAmount ?? 0)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-grid-3-react dash-insight-grid">
        <div className="admin-panel-react dash-info-panel">
          <h3>Admin Shortcuts</h3>

          <div className="dash-shortcut-list">
            <Link to="/admin/reservations">
              <CalendarCheck size={16} aria-hidden="true" />
              Reservations
            </Link>

            <Link to="/admin/payments">
              <PhilippinePeso size={16} aria-hidden="true" />
              Payments
            </Link>

            <Link to="/admin/refunds">
              <HandCoins size={16} aria-hidden="true" />
              Refunds
            </Link>

            <Link to="/admin/forms">
              <RefreshCw size={16} aria-hidden="true" />
              Pricing Forms
            </Link>
          </div>
        </div>

        <div className="admin-panel-react dash-info-panel">
          <h3>Admin Workload</h3>

          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Total action required</span>
              <strong
                style={{
                  color: totalActionRequired > 0 ? COLORS.orange : COLORS.green,
                }}
              >
                {totalActionRequired}
              </strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Pending payment reviews</span>
              <strong>{stats?.pendingPaymentBookings ?? "—"}</strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Pending refund reviews</span>
              <strong>{stats?.pendingRefundRequests ?? "—"}</strong>
            </div>
          </div>
        </div>

        <div className="admin-panel-react dash-info-panel">
          <h3>System Status</h3>

          <div className="admin-stat-list-react dash-system-list">
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
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}