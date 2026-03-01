import "../assets/css/about.css";
import Navbar from "../components/Navbar";

export default function About() {
  return (
    <>

        <Navbar />
      {/* OUR STORY */}
      <section className="story-section">
        <div className="story-wrap">
          <div>
            <h1 className="title">OUR STORY</h1>
            <p>
              We share matcha the way it’s meant to be enjoyed—fresh, vibrant, and rooted in tradition.
              Our goal is to help everyone discover authentic matcha through thoughtful preparation and
              quality ingredients
            </p>
          </div>

          <div className="owner-image-wrap">
            <img src="/images/queen-teri.png" alt="Teri" />
          </div>
        </div>
      </section>

      {/* NAME */}
      <section className="name-section">
        <div className="name-wrap">
          <div className="name-line">
            <h1>Jannah Terisha Plastina</h1>
          </div>
          <p className="name-desc">
            Teri is the visionary behind MATCHABYTERI, a brand created from a deep
            appreciation for the art and culture of matcha.
          </p>
        </div>
      </section>

      {/* ORIGIN */}
      <section className="origin-section">
        <div className="matcha-wrap">
          <div className="collage">
            <div className="matcha1 frame top-left">
              <img src="/images/about-matcha-1.png" alt="Matcha drink 1" />
            </div>

            <div className="matcha2 frame bottom-right">
              <img src="/images/about-matcha-2.png" alt="Matcha preparation" />
            </div>
          </div>

          <div className="origin-text">
            <h1>MATCHA</h1>
            <h1>BY TERI</h1>
            <h4>Started April 2025</h4>
            <p>
              We are dedicated in offering matcha beverages to enthusiasts who appreciate its rich flavor
              and culture. Through our drinks and knowledge, we aim to help people discover matcha they
              can truly enjoy by sharing authentic flavors and culture, ensuring everyone experiences the
              true essence of matcha.
            </p>
          </div>
        </div>
      </section>

      {/* FOLLOW */}
      <section className="follow-section">
        <div className="follow-wrap">
          <div className="follow-text">
            <h1>FOLLOW US</h1>

            <div className="follow-list">
              <div className="follow-item">
                <img src="/images/green-ig.png" alt="Instagram" />
                <span>matchabyteri</span>
              </div>

              <div className="follow-item">
                <img src="/images/green-email.png" alt="Email" />
                <span>matchabyteri@gmail.com</span>
              </div>

              <div className="follow-item">
                <img src="/images/green-fb.png" alt="Facebook" />
                <span>matchabyteri</span>
              </div>
            </div>
          </div>

          <div className="last-matcha-image">
            <img src="/images/about-matcha-3.png" alt="Matcha drink 3" />
          </div>
        </div>
      </section>
    </>
  );
}