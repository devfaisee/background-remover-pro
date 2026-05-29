// Verynt Pro - Unified Rewarded Ads & Monkey-Patching Engine
(function() {
  const VeryntRewardedAds = {
    enabled: true,
    cooldownMs: 8000, // 8-second rewarded countdown
    
    init: function() {
      // Monkey-patch HTMLAnchorElement.prototype.click
      const originalClick = HTMLAnchorElement.prototype.click;
      const self = this;
      
      HTMLAnchorElement.prototype.click = function() {
        if (self.enabled && this.hasAttribute('download')) {
          const fileName = this.getAttribute('download') || 'file';
          self.triggerRewardedAd(fileName, () => {
            originalClick.call(this);
          });
        } else {
          originalClick.call(this);
        }
      };
    },
    
    triggerRewardedAd: function(fileName, onComplete) {
      // Create modal elements
      const modalId = 'verynt-rewarded-ad-modal';
      let modal = document.getElementById(modalId);
      if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(7, 7, 10, 0.85);
          backdrop-filter: blur(16px);
          z-index: 100000;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.3s ease;
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #ffffff;
        `;
        document.body.appendChild(modal);
      }
      
      modal.innerHTML = `
        <div class="rewarded-ad-card" style="
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(24px);
          border-radius: 20px;
          padding: 2.5rem;
          max-width: 460px;
          width: 90%;
          text-align: center;
          transform: scale(0.9);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
          <!-- Premium Icon & Header -->
          <div style="font-size: 3.5rem; margin-bottom: 0.75rem; filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.5));">🎁</div>
          <h3 style="font-size: 1.5rem; font-weight: 750; background: linear-gradient(135deg, #a78bfa 0%, #22d3ee 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; letter-spacing: -0.5px;">Sponsor Presentation</h3>
          <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5; margin-bottom: 1.5rem;">To keep Verynt Pro 100% free and locally processed, support us by viewing this quick sponsor video to unlock your download!</p>
          
          <!-- High-End Simulated Video Display Frame -->
          <div style="
            background: #030712;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            min-height: 140px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
          ">
            <!-- Simulated glowing logo overlay -->
            <div style="
              width: 42px;
              height: 42px;
              border-radius: 50%;
              background: linear-gradient(135deg, #8B5CF6, #06B6D4);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.25rem;
              box-shadow: 0 0 15px rgba(139, 92, 246, 0.6);
              margin-bottom: 0.75rem;
            ">⚡</div>
            <div style="font-weight: 700; color: #ffffff; font-size: 1rem; margin-bottom: 0.15rem; letter-spacing: -0.25px;">FastHost Cloud Solutions</div>
            <div style="font-size: 0.75rem; color: #94a3b8; line-height: 1.4; max-width: 300px;">Host high-performance static web portals for $0/month. 100% net margin models ready.</div>
            
            <span style="
              position: absolute;
              top: 8px;
              left: 8px;
              font-size: 0.6rem;
              color: #a78bfa;
              font-weight: 700;
              letter-spacing: 0.08em;
              background: rgba(167, 139, 250, 0.15);
              padding: 0.2rem 0.5rem;
              border-radius: 4px;
              border: 1px solid rgba(167, 139, 250, 0.2);
            ">TEST REWARDED AD</span>
          </div>
          
          <!-- Countdown Timer & Actions -->
          <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
            <div style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 3px; overflow: hidden; margin-bottom: 0.5rem;">
              <div id="rewarded-ad-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #a78bfa, #22d3ee); transition: width 0.1s linear;"></div>
            </div>
            <span id="rewarded-ad-timer-text" style="font-size: 0.85rem; color: #cbd5e1; font-weight: 600;">Unlocking download in 8s...</span>
          </div>

          <!-- Dev skip button -->
          <button id="btn-skip-test-ad" style="
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #94a3b8;
            padding: 0.4rem 1.2rem;
            font-size: 0.75rem;
            border-radius: 9999px;
            cursor: pointer;
            transition: all 0.2s ease;
          " onmouseover="this.style.color='#ffffff'; this.style.borderColor='rgba(255,255,255,0.3)'" onmouseout="this.style.color='#94a3b8'; this.style.borderColor='rgba(255,255,255,0.15)'">
            ⚡ Skip Test Ad (Developer Sandbox)
          </button>
        </div>
      `;
      
      modal.style.display = 'flex';
      setTimeout(() => {
        modal.style.opacity = '1';
        modal.querySelector('.rewarded-ad-card').style.transform = 'scale(1)';
      }, 10);
      
      const totalMs = this.cooldownMs;
      let msLeft = totalMs;
      const progressBar = document.getElementById('rewarded-ad-progress-bar');
      const timerText = document.getElementById('rewarded-ad-timer-text');
      const skipBtn = document.getElementById('btn-skip-test-ad');
      
      const updateInterval = 100; // Update every 100ms for smooth fluid transition
      
      const interval = setInterval(() => {
        msLeft -= updateInterval;
        const percent = ((totalMs - msLeft) / totalMs) * 100;
        progressBar.style.width = `${percent}%`;
        
        const secondsLeft = Math.ceil(msLeft / 1000);
        if (msLeft > 0) {
          timerText.textContent = `Unlocking download in ${secondsLeft}s...`;
        } else {
          completeAd();
        }
      }, updateInterval);
      
      function completeAd() {
        clearInterval(interval);
        timerText.textContent = 'Download Unlocked! 🎉';
        progressBar.style.width = '100%';
        
        setTimeout(() => {
          self.closeAdModal();
          onComplete();
        }, 500);
      }
      
      skipBtn.addEventListener('click', () => {
        completeAd();
      });
    },
    
    closeAdModal: function() {
      const modal = document.getElementById('verynt-rewarded-ad-modal');
      if (modal) {
        modal.style.opacity = '0';
        modal.querySelector('.rewarded-ad-card').style.transform = 'scale(0.9)';
        setTimeout(() => {
          modal.style.display = 'none';
        }, 300);
      }
    }
  };
  
  // Wait for document to load to initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => VeryntRewardedAds.init());
  } else {
    VeryntRewardedAds.init();
  }
})();