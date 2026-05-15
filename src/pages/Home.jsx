import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "../assets/css/home.css";

function Home() {
  return (
    <>
      <Navbar />

      <section>
        <div className="image-wrap">
          <img src="/images/MBT_white 1.png" alt="" />

          <div className="text-box">
            <p>Learn about the greens</p>
            <p>(not the ones you're thinking of, the good stuff)</p>
          </div>
        </div>
      </section>

      {/* 
        ✅ START OF READABLE CONTENT 
        The voice assistant will now read everything inside this div 
        when you say "Read content"
      */}
      <div id="readable-content">
        
        <section className="welcome-section">
          <div className="welcome-inner">
            <div className="welcome-text">
              <h2>Welcome!</h2>
              <p>
                Welcome to MatchabyTeri, where every sip tells a story. We’re
                passionate about sharing the art of matcha through private workshops
                and exclusive events. Whether you’re new to matcha or a long-time
                enthusiast, our experiences are designed to connect you with the calm,
                beauty, and flavor of this traditional Japanese tea.
              </p>

              <button className="welcome-btn">Book now</button>
            </div>

            <div className="welcome-image-wrap">
              <img
                src="/images/matchacoffee1.png"
                alt="Matcha drink"
                className="welcome-image"
              />
            </div>
          </div>

          <div className="welcome-pill">
            We bring together everything you love about matcha — its calming beauty,
            delicious taste, and meaningful tradition.
          </div>
        </section>

        <section className="services-section">
          <div className="m-w">
            OUR DELICIOUS SERVICES
          </div>

          <div className="workshop-inner">
            <div className="workshop-image-wrap">
              <img
                src="/images/1st pic 1.png"
                alt="Matcha drink"
                className="workshop-image"
              />
            </div>

            <div className="workshop-text">
              <h2>
                <span className="black-text">Matcha</span> Workshops
              </h2>
              <p>
                We host private workshops where you can learn how to prepare,
                whisk, and enjoy authentic matcha the traditional way.
              </p>

              <button className="workshop-btn">Learn more</button>
            </div>
          </div>

          <div className="welcome-inner">
            <div className="welcome-text">
              <h2>
                <span className="black-text">Custom</span> Events
              </h2>
              <p>
                We host private workshops where you can learn how to prepare,
                whisk, and enjoy authentic matcha the traditional way.
              </p>

              <button className="welcome-btn">Learn more</button>
            </div>

            <div className="welcome-image-wrap">
              <img
                src="/images/2nd pic 1.png"
                alt="Matcha drink"
                className="welcome-image"
              />
            </div>
          </div>

          <div className="welcome-inner">
            <div className="welcome-text">
              <h2 id="matcha">Matcha</h2>
              <h2 id="creations">Creations</h2>
              <p>
                Book now to try our delicious matcha to experience the good green
                stuff, not one you're thinking of.
              </p>

              <button className="welcome-btn">Learn more</button>
            </div>

            <div className="welcome-image-wrap">
              <img
                src="/images/lastpicmain.png"
                alt="Matcha drink"
                className="last-image"
              />
            </div>
          </div>
        </section>

      {/* ✅ END OF READABLE CONTENT */}
      </div>

      <Footer />
    </>
  );
}

export default Home;