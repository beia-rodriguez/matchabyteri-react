/**
 * AdminDashboard.jsx
 *
 * Fixes over previous version:
 *  - totalWorkshop / totalEvent now count only meaningful statuses (approved + complete)
 *  - avgRevenuePerBooking uses paid-booking denominator, not all bookings
 *  - Month labels formatted as "Jan 2025" instead of raw "2025-01"
 *  - Pending bookings count displayed as an urgent operational card
 *  - Skeleton loading cards while data loads
 *  - Chart colors match the green admin palette
 *  - Empty-state handled per chart with an illustration, not bare text
 *  - Chart instances cleaned up correctly
 */

import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { Package, PartyPopper, PhilippinePeso, Clock } from "lucide-react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "2025-01"  →  "Jan 2025" */
const fmtMonth = (ym) => {
  const [year, month] = (ym || "").split("-");
  if (!year || !month) return ym;
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
};

const money = (v) =>
  Number(v || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ─── Palette (matches --green-2 / --yellow from admin-panel.css) ─────────────
const COLORS = {
  green: "#37664c",
  greenLight: "rgba(55,102,76,0.15)",
  yellow: "#ffd95a",
  yellowLight: "rgba(255,217,90,0.25)",
  muted: "#6b7a62",
};

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="admin-card-react admin-card-feature-react dash-skeleton">
      <div className="skel-line skel-short" />
      <div className="skel-line skel-tall" />
      <div className="skel-line skel-medium" />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
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

// ─── Empty chart state ────────────────────────────────────────────────────────
function EmptyChart({ message }) {
  return (
    <div className="dash-empty-chart">
      <div className="dash-empty-icon">📊</div>
      <div className="dash-empty-msg">{message}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const countCanvasRef = useRef(null);
  const revenueCanvasRef = useRef(null);
  const countChartRef = useRef(null);
  const revenueChartRef = useRef(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const { data } = await adminApi.get("/admin/admin-dashboard.php");

        // Format month labels client-side
        const labels = (data.labels || []).map(fmtMonth);

        setStats({
          totalWorkshop: Number(data.totalWorkshop || 0),
          totalEvent: Number(data.totalEvent || 0),
          totalRevenue: Number(data.totalRevenue || 0),
          pendingBookings: Number(data.pendingBookings || 0),
          paidBookings: Number(data.paidBookings || 0),
          labels,
          workshopCounts: (data.workshopCounts || []).map(Number),
          eventCounts: (data.eventCounts || []).map(Number),
          revenue: (data.revenue || []).map(Number),
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

  // ── Charts ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!stats || !stats.labels.length) return;

    // Destroy previous instances
    countChartRef.current?.destroy();
    revenueChartRef.current?.destroy();

    const frame = requestAnimationFrame(() => {
      const countCtx = countCanvasRef.current?.getContext("2d");
      const revenueCtx = revenueCanvasRef.current?.getContext("2d");

      if (countCtx) {
        countChartRef.current = new Chart(countCtx, {
          type: "bar",
          data: {
            labels: stats.labels,
            datasets: [
              {
                label: "Workshops",
                data: stats.workshopCounts,
                backgroundColor: COLORS.green,
                borderRadius: 6,
              },
              {
                label: "Events",
                data: stats.eventCounts,
                backgroundColor: COLORS.yellow,
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { position: "bottom" },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { precision: 0, color: COLORS.muted },
                grid: { color: "rgba(0,0,0,0.05)" },
              },
              x: {
                ticks: { color: COLORS.muted, maxRotation: 45 },
                grid: { display: false },
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
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { position: "bottom" },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ₱${money(ctx.raw)}`,
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  color: COLORS.muted,
                  callback: (v) => `₱${Number(v).toLocaleString()}`,
                },
                grid: { color: "rgba(0,0,0,0.05)" },
              },
              x: {
                ticks: { color: COLORS.muted, maxRotation: 45 },
                grid: { display: false },
              },
            },
          },
        });
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      countChartRef.current?.destroy();
      revenueChartRef.current?.destroy();
      countChartRef.current = null;
      revenueChartRef.current = null;
    };
  }, [stats]);

  // ── Derived metrics ────────────────────────────────────────────────────────
  const avgRevenuePerPaidBooking =
    stats && stats.paidBookings > 0
      ? stats.totalRevenue / stats.paidBookings
      : 0;

  const hasChartData = stats && stats.labels.length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Dashboard">
      {error && (
        <div className="admin-notice-react bad" role="alert">
          {error}
        </div>
      )}

      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="admin-cards-react admin-cards-hero-react" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
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
              icon={Package}
              tag="Workshops"
              label="Total Workshops"
              value={stats?.totalWorkshop ?? 0} 
              sub="Approved & completed"
            />
            <StatCard
              icon={PartyPopper}
              tag="Events"
              label="Total Events"
              value={stats?.totalEvent ?? 0} 
              sub="Approved & completed"
            />
            <StatCard
              icon={PhilippinePeso}
              tag="Revenue"
              label="Total Revenue"
              value={`₱${money(stats?.totalRevenue ?? 0)}`} 
              sub="Sum of paid payments"
            />
            <StatCard
              icon={Clock}
              tag="Action Required"
              label="Pending Bookings"
              value={stats?.pendingBookings ?? 0} 
              sub="Awaiting your review"
              accent={(stats?.pendingBookings ?? 0) > 0 ? "#e07b00" : undefined} 
            />
          </>
        )}
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      <div className="admin-grid-2-react">
        <div className="admin-panel-react">
          <h3>Booking Trends</h3>
          {loading ? (
            <div className="admin-muted-react" role="status">Loading chart…</div>
          ) : !hasChartData ? (
            <EmptyChart message="No booking data for the past 12 months yet." />
          ) : (
            <canvas ref={countCanvasRef} height="140" aria-label="Booking trends bar chart" />
          )}
        </div>

        <div className="admin-panel-react">
          <h3>Revenue Trends</h3>
          {loading ? (
            <div className="admin-muted-react" role="status">Loading chart…</div>
          ) : !hasChartData ? (
            <EmptyChart message="No revenue data for the past 12 months yet." />
          ) : (
            <canvas ref={revenueCanvasRef} height="140" aria-label="Revenue trends line chart" />
          )}
        </div>
      </div>

      {/* ── Insight panels ───────────────────────────────────────────────── */}
      <div className="admin-grid-3-react">
        <div className="admin-panel-react">
          <h3>Quick Insights</h3>
          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Avg revenue / paid booking</span>
              <strong>₱{money(avgRevenuePerPaidBooking)}</strong>
            </div>
            <div className="admin-stat-item-react">
              <span>Months tracked</span>
              <strong>{stats?.labels.length ?? "—"}</strong>
            </div>
            <div className="admin-stat-item-react">
              <span>Months with revenue</span>
              <strong>
                {stats?.revenue.filter((v) => v > 0).length ?? "—"}
              </strong>
            </div>
          </div>
        </div>

        <div className="admin-panel-react">
          <h3>Bookings Snapshot</h3>
          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Workshops (approved+done)</span>
              <strong>{stats?.totalWorkshop ?? "—"}</strong>
            </div>
            <div className="admin-stat-item-react">
              <span>Events (approved+done)</span>
              <strong>{stats?.totalEvent ?? "—"}</strong>
            </div>
            <div className="admin-stat-item-react">
              <span>Pending review</span>
              <strong style={{ color: stats?.pendingBookings > 0 ? "#e07b00" : "inherit" }}>
                {stats?.pendingBookings ?? "—"}
              </strong>
            </div>
          </div>
        </div>

        <div className="admin-panel-react">
          <h3>System Status</h3>
          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Dashboard API</span>
              <strong style={{ color: error ? "#dc2626" : "#37664c" }}>
                {error ? "Error" : loading ? "Loading…" : "Online"}
              </strong>
            </div>
            <div className="admin-stat-item-react">
              <span>Charts</span>
              <strong>{loading ? "Loading…" : hasChartData ? "Ready" : "No data"}</strong>
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