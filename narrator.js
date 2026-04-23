/* ============================================================
   narrator.js — AI Business Strategy Voice Narration
   Uses Web Speech API with male voice
   ============================================================ */

const NarratorModule = (() => {
  let synth = window.speechSynthesis;
  let currentUtterance = null;
  let isPlaying = false;
  let isPaused = false;
  let currentSegment = 0;
  let segments = [];
  let maleVoice = null;

  // Build narration script from live data
  function buildScript(data) {
    const s = data.summary;
    const topState = data.revenueByState[0];
    const topProduct = data.revenueByProduct[0];
    const topBrand = data.revenueByBrand[0];
    const topChannel = data.revenueByChannel[0];
    const rev2019 = data.revenueByYear.find(y => y.name === '2019')?.value || 0;
    const rev2022 = data.revenueByYear.find(y => y.name === '2022')?.value || 0;
    const yoyChange = ((rev2022 - rev2019) / rev2019 * 100).toFixed(1);
    const alertPct = s.belowThresholdPct;
    const retailShare = ((data.revenueByChannel.find(c => c.name === 'Retail')?.value / s.totalRevenue) * 100).toFixed(1);
    const onlineShare = ((data.revenueByChannel.find(c => c.name === 'Online')?.value / s.totalRevenue) * 100).toFixed(1);

    segments = [
      {
        id: 'header',
        text: `Welcome to the Country Delight Dairy Analytics Dashboard. I'm your AI business analyst, and I'll walk you through the key insights and strategic recommendations based on our analysis of over ${(s.totalRows/1000).toFixed(0)} thousand transaction records spanning from 2019 to 2022.`
      },
      {
        id: 'kpi-section',
        text: `Let's start with the big picture. Our total revenue stands at ${(s.totalRevenue/1e7).toFixed(1)} crore rupees, with over ${(s.totalQuantitySold/1e6).toFixed(1)} million units sold across ${s.totalProducts} dairy product categories from ${s.totalBrands} brands, distributed across ${s.totalStates} states. These numbers reflect a mature, large-scale dairy operation.`
      },
      {
        id: 'section-3d',
        text: `Looking at state-wise revenue distribution, ${topState.name} leads with ${(topState.value/1e7).toFixed(1)} crore rupees, closely followed by Chandigarh. Strategic recommendation: These two markets together contribute nearly 24 percent of total revenue. We should strengthen our distribution network and brand presence in these high-performing states while exploring growth opportunities in underperforming states like Tamil Nadu and Rajasthan, which show untapped potential.`
      },
      {
        id: 'section-products',
        text: `In product performance, ${topProduct.name} is our revenue leader, followed by Lassi and Butter. Interestingly, revenue is fairly evenly distributed across all 10 products, with no single product exceeding 11 percent share. Strategy: This balanced portfolio is a strength. However, we should consider premium product lines in our top 3 categories to increase average revenue per unit. ${topBrand.name} dominates brand revenue at ${(topBrand.value/1e7).toFixed(1)} crore, followed by Mother Dairy. We should study Amul's distribution model and pricing strategy for competitive insights.`
      },
      {
        id: 'section-sales',
        text: `Sales channel analysis reveals that Retail contributes ${retailShare} percent of revenue, while Online accounts for ${onlineShare} percent. Future strategy: The online channel represents significant growth potential. With India's e-commerce penetration growing at 25 percent annually, investing in direct-to-consumer digital channels, cold chain logistics for last-mile delivery, and subscription-based models could significantly boost online revenue. The monthly trend shows seasonal patterns with peaks in January and July. We should align marketing campaigns and inventory planning with these seasonal trends.`
      },
      {
        id: 'section-extra',
        text: `Year-over-year analysis shows a ${Math.abs(yoyChange)} percent ${parseFloat(yoyChange) >= 0 ? 'growth' : 'decline'} from 2019 to 2022. The revenue plateaued around 41 to 43 crore per year. Strategic action: To break through this plateau, we recommend three initiatives. First, geographic expansion into untapped Tier 2 and Tier 3 cities. Second, product innovation with value-added dairy products like flavored milk and probiotic yogurt. Third, strategic partnerships with food delivery platforms. Storage analysis shows 57 percent of products require refrigeration, indicating heavy cold chain dependency. Investing in advanced cold storage technology could reduce spoilage and improve margins.`
      },
      {
        id: 'section-inventory',
        text: `Critical alert: ${alertPct} percent of our inventory is below minimum stock threshold, with over ${s.outOfStockCount.toLocaleString()} out-of-stock instances. This is a significant operational risk. Immediate action required: Implement an AI-powered demand forecasting system to predict stock requirements. Automate reorder triggers when stock approaches threshold levels. Prioritize restocking in high-revenue states like Delhi and Chandigarh where stockouts directly impact our top-line revenue.`
      },
      {
        id: 'section-geo',
        text: `Finally, the geographic heatmap confirms that Delhi and Chandigarh are our revenue powerhouses, each contributing about 11 to 12 percent of total revenue. The remaining 13 states are closely clustered between 5 and 7 percent each. Growth strategy: Focus on converting medium-performing states like Uttar Pradesh, Maharashtra, and Bihar into high-performing markets through targeted marketing, local brand ambassadors, and state-specific product offerings. In summary, Country Delight has a strong foundation with diversified products and broad geographic presence. The key strategic priorities for future planning are: accelerating digital and online sales, implementing smart inventory management, breaking the revenue plateau through innovation, and deepening penetration in high-potential markets. Thank you for reviewing this analysis.`
      }
    ];

    return segments;
  }

  // Find a male voice
  function selectMaleVoice() {
    const voices = synth.getVoices();
    // Priority: look for specific high-quality male voices
    const preferred = [
      'Google UK English Male',
      'Microsoft David',
      'Microsoft Mark',
      'Google US English',
      'Daniel',
      'Alex',
      'English Male'
    ];
    
    for (const name of preferred) {
      const found = voices.find(v => v.name.includes(name));
      if (found) return found;
    }
    
    // Fallback: find any English male voice
    const englishMale = voices.find(v => 
      v.lang.startsWith('en') && 
      (v.name.toLowerCase().includes('male') || 
       v.name.includes('David') || 
       v.name.includes('Mark') ||
       v.name.includes('James') ||
       v.name.includes('Daniel'))
    );
    if (englishMale) return englishMale;

    // Fallback: any English voice
    const english = voices.find(v => v.lang.startsWith('en'));
    if (english) return english;

    return voices[0] || null;
  }

  function highlightSection(id) {
    // Remove previous highlights
    document.querySelectorAll('.narrator-highlight').forEach(el => {
      el.classList.remove('narrator-highlight');
    });
    // Add highlight
    const section = document.getElementById(id);
    if (section) {
      section.classList.add('narrator-highlight');
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function speakSegment(index) {
    if (index >= segments.length) {
      stop();
      updateUI('ended');
      return;
    }

    currentSegment = index;
    const seg = segments[index];
    highlightSection(seg.id);
    updateProgress();

    const utter = new SpeechSynthesisUtterance(seg.text);
    utter.voice = maleVoice;
    utter.rate = 0.92;
    utter.pitch = 0.95;
    utter.volume = 1;

    utter.onend = () => {
      if (isPlaying && !isPaused) {
        speakSegment(index + 1);
      }
    };

    utter.onerror = (e) => {
      console.warn('Speech error:', e);
      if (isPlaying) speakSegment(index + 1);
    };

    currentUtterance = utter;
    synth.speak(utter);
  }

  function updateProgress() {
    const bar = document.getElementById('narrator-progress-fill');
    const label = document.getElementById('narrator-segment-label');
    if (bar) {
      const pct = ((currentSegment + 1) / segments.length) * 100;
      bar.style.width = pct + '%';
    }
    if (label) {
      const names = ['Introduction', 'Key Metrics', 'State Revenue', 'Products & Brands', 'Sales Channels', 'Yearly Analysis', 'Inventory Health', 'Growth Strategy'];
      label.textContent = names[currentSegment] || '';
    }
  }

  function updateUI(state) {
    const btn = document.getElementById('narrator-play-btn');
    const icon = document.getElementById('narrator-play-icon');
    const pulse = document.getElementById('narrator-pulse');
    const statusText = document.getElementById('narrator-status');

    if (state === 'playing') {
      icon.textContent = '⏸';
      pulse.classList.add('active');
      statusText.textContent = 'Narrating...';
      btn.title = 'Pause narration';
    } else if (state === 'paused') {
      icon.textContent = '▶';
      pulse.classList.remove('active');
      statusText.textContent = 'Paused';
      btn.title = 'Resume narration';
    } else {
      icon.textContent = '▶';
      pulse.classList.remove('active');
      statusText.textContent = 'Play Analysis';
      btn.title = 'Start narration';
      const bar = document.getElementById('narrator-progress-fill');
      if (bar) bar.style.width = '0%';
    }
  }

  // Public API
  function play(data) {
    if (!synth) {
      alert('Sorry, your browser does not support speech synthesis.');
      return;
    }

    if (isPaused) {
      synth.resume();
      isPaused = false;
      isPlaying = true;
      updateUI('playing');
      return;
    }

    if (isPlaying) {
      synth.pause();
      isPaused = true;
      isPlaying = false;
      updateUI('paused');
      return;
    }

    // Start fresh
    synth.cancel();
    maleVoice = selectMaleVoice();
    buildScript(data);
    isPlaying = true;
    isPaused = false;
    currentSegment = 0;
    updateUI('playing');
    speakSegment(0);
  }

  function stop() {
    synth.cancel();
    isPlaying = false;
    isPaused = false;
    currentSegment = 0;
    updateUI('ended');
    document.querySelectorAll('.narrator-highlight').forEach(el => {
      el.classList.remove('narrator-highlight');
    });
  }

  function skip(direction) {
    synth.cancel();
    const next = currentSegment + direction;
    if (next >= 0 && next < segments.length) {
      isPlaying = true;
      isPaused = false;
      updateUI('playing');
      speakSegment(next);
    }
  }

  // Init voices (some browsers load them async)
  function init() {
    if (synth.getVoices().length === 0) {
      synth.addEventListener('voiceschanged', () => {
        maleVoice = selectMaleVoice();
      });
    } else {
      maleVoice = selectMaleVoice();
    }
  }

  init();

  return { play, stop, skip };
})();
