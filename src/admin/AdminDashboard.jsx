import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { Package, PartyPopper, PhilippinePeso } from "lucide-react";
import AdminLayout from "./AdminLayout";
import adminApi from "@/services/adminApi";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalWorkshop: 0,
    totalEvent: 0,
    totalRevenue: 0,
    labels: [],
    workshopCounts: [],
    eventCounts: [],
    revenue: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const countCanvasRef = useRef(null);
  const revenueCanvasRef = useRef(null);
  const countChartRef = useRef(null);
  const revenueChartRef = useRef(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const { data } = await adminApi.get("/admin/admin-dashboard.php");

        setStats({
          totalWorkshop: Number(data?.totalWorkshop || 0),
          totalEvent: Number(data?.totalEvent || 0),
          totalRevenue: Number(data?.totalRevenue || 0),
          labels: Array.isArray(data?.labels) ? data.labels : [],
          workshopCounts: Array.isArray(data?.workshopCounts)
            ? data.workshopCounts.map(Number)
            : [],
          eventCounts: Array.isArray(data?.eventCounts)
            ? data.eventCounts.map(Number)
            : [],
          revenue: Array.isArray(data?.revenue)
            ? data.revenue.map(Number)
            : [],
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!countCanvasRef.current || !revenueCanvasRef.current) return;
    if (!stats.labels.length) return;

    if (countChartRef.current) {
      countChartRef.current.destroy();
      countChartRef.current = null;
    }

    if (revenueChartRef.current) {
      revenueChartRef.current.destroy();
      revenueChartRef.current = null;
    }

    const frame = requestAnimationFrame(() => {
      const countCtx = countCanvasRef.current?.getContext("2d");
      const revenueCtx = revenueCanvasRef.current?.getContext("2d");

      if (!countCtx || !revenueCtx) return;

      countChartRef.current = new Chart(countCtx, {
        type: "bar",
        data: {
          labels: stats.labels,
          datasets: [
            {
              label: "Workshops (Approved/Complete)",
              data: stats.workshopCounts,
              borderRadius: 8,
            },
            {
              label: "Events (Approved/Complete)",
              data: stats.eventCounts,
              borderRadius: 8,
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
            y: { beginAtZero: true },
          },
        },
      });

      revenueChartRef.current = new Chart(revenueCtx, {
        type: "line",
        data: {
          labels: stats.labels,
          datasets: [
            {
              label: "Revenue (Paid GCash Payments)",
              data: stats.revenue,
              tension: 0.35,
              fill: false,
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
              ticks: {
                callback: (value) => "₱" + value,
              },
            },
          },
        },
      });
    });

    return () => {
      cancelAnimationFrame(frame);

      if (countChartRef.current) {
        countChartRef.current.destroy();
        countChartRef.current = null;
      }

      if (revenueChartRef.current) {
        revenueChartRef.current.destroy();
        revenueChartRef.current = null;
      }
    };
  }, [stats, loading]);

  const avgRevenuePerEvent =
    stats.totalEvent > 0 ? stats.totalRevenue / stats.totalEvent : 0;

  return (
    <AdminLayout title="Dashboard">
      {error && <div className="admin-notice-react bad">{error}</div>}

      <div className="admin-cards-react admin-cards-hero-react">
        <div className="admin-card-react admin-card-feature-react">
          <div className="admin-card-label-react">
            <Package size={14} />
            <span>Workshops</span>
          </div>
          <h4>Total Workshops</h4>
          <div className="admin-big-react">{stats.totalWorkshop}</div>
          <div className="admin-muted-react">All workshop bookings</div>
        </div>

        <div className="admin-card-react admin-card-feature-react">
          <div className="admin-card-label-react">
            <PartyPopper size={14} />
            <span>Events</span>
          </div>
          <h4>Total Private Events</h4>
          <div className="admin-big-react">{stats.totalEvent}</div>
          <div className="admin-muted-react">All event bookings</div>
        </div>

        <div className="admin-card-react admin-card-feature-react">
          <div className="admin-card-label-react">
            <PhilippinePeso size={14} />
            <span>Revenue</span>
          </div>
          <h4>Total Revenue</h4>
          <div className="admin-big-react">
            ₱
            {stats.totalRevenue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="admin-muted-react">Sum of payments marked “paid”</div>
        </div>
      </div>

      <div className="admin-grid-2-react">
        <div className="admin-panel-react">
          <h3>Booking Trends</h3>
          {loading ? (
            <div className="admin-muted-react">Loading chart...</div>
          ) : (
            <canvas ref={countCanvasRef} height="120" />
          )}
        </div>

        <div className="admin-panel-react">
          <h3>Revenue Trends</h3>
          {loading ? (
            <div className="admin-muted-react">Loading chart...</div>
          ) : (
            <canvas ref={revenueCanvasRef} height="120" />
          )}
        </div>
      </div>

      <div className="admin-grid-3-react">
        <div className="admin-panel-react">
          <h3>Quick Insights</h3>
          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Avg revenue per event</span>
              <strong>
                ₱
                {avgRevenuePerEvent.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Months tracked</span>
              <strong>{stats.labels.length}</strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Revenue entries</span>
              <strong>{stats.revenue.filter((v) => Number(v) > 0).length}</strong>
            </div>
          </div>
        </div>

        <div className="admin-panel-react">
          <h3>Bookings Snapshot</h3>
          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Total workshops</span>
              <strong>{stats.totalWorkshop}</strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Total events</span>
              <strong>{stats.totalEvent}</strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Total revenue</span>
              <strong>
                ₱
                {stats.totalRevenue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          </div>
        </div>

        <div className="admin-panel-react">
          <h3>System Status</h3>
          <div className="admin-stat-list-react">
            <div className="admin-stat-item-react">
              <span>Dashboard API</span>
              <strong>{error ? "Error" : "Online"}</strong>
            </div>

            <div className="admin-stat-item-react">
              <span>Charts</span>
              <strong>{loading ? "Loading" : "Ready"}</strong>
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