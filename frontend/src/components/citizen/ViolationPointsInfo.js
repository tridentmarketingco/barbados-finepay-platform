/**
 * Violation Points Info Component
 * Reference table showing points and fines for common violations
 */

import React, { useState, useEffect } from 'react';
import { pointsApi } from '../../services/pointsApi';

function ViolationPointsInfo({ collapsed = false }) {
  const [offences, setOffences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!collapsed);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadOffenceTable();
  }, []);

  const loadOffenceTable = async () => {
    try {
      setLoading(true);
      const result = await pointsApi.getOffencePointsTable();
      if (result.data && result.data.offences) {
        setOffences(result.data.offences);
      }
    } catch (err) {
      console.error('Failed to load offence table:', err);
      // Use hardcoded defaults
      setOffences([
        { offence_code: 'SPEEDING_MINOR', points: 3, fine_min: 300, fine_max: 600, category: 'speeding' },
        { offence_code: 'SPEEDING_SERIOUS', points: 6, fine_min: 1000, fine_max: 2000, category: 'speeding' },
        { offence_code: 'CARELESS_DANGEROUS', points: 7, fine_min: 2000, fine_max: 5000, category: 'dangerous' },
        { offence_code: 'DRINK_DRIVING', points: 11, fine_min: 3000, fine_max: 10000, category: 'alcohol' },
        { offence_code: 'RED_LIGHT', points: 4, fine_min: 500, fine_max: 1000, category: 'traffic' },
        { offence_code: 'NO_SEATBELT', points: 2, fine_min: 200, fine_max: 750, category: 'safety' },
        { offence_code: 'MOBILE_PHONE', points: 4, fine_min: 400, fine_max: 800, category: 'distraction' },
        { offence_code: 'UNLICENSED', points: 9, fine_min: 1500, fine_max: 4000, category: 'license' },
        { offence_code: 'NO_INSURANCE', points: 9, fine_min: 2000, fine_max: 5000, category: 'insurance' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: 'all', label: 'All Offences' },
    { value: 'speeding', label: '🏎️ Speeding' },
    { value: 'dangerous', label: '🚗 Dangerous Driving' },
    { value: 'alcohol', label: '🍺 Alcohol' },
    { value: 'traffic', label: '🚦 Traffic Signals' },
    { value: 'safety', label: '🦺 Safety' },
    { value: 'distraction', label: '📱 Distraction' },
    { value: 'license', label: '🪪 License' },
    { value: 'insurance', label: '📋 Insurance' }
  ];

  const getCategoryIcon = (category) => {
    const icons = {
      speeding: '🏎️',
      dangerous: '🚗',
      alcohol: '🍺',
      traffic: '🚦',
      safety: '🦺',
      distraction: '📱',
      license: '🪪',
      insurance: '📋'
    };
    return icons[category] || '📋';
  };

  const getPointsColor = (points) => {
    if (points >= 10) return '#f44336'; // Red - Severe
    if (points >= 6) return '#ff9800'; // Orange - Serious
    if (points >= 4) return '#ffeb3b'; // Yellow - Moderate
    return '#4caf50'; // Green - Minor
  };

  const getPointsLabel = (points) => {
    if (points >= 10) return 'Severe';
    if (points >= 6) return 'Serious';
    if (points >= 4) return 'Moderate';
    return 'Minor';
  };

  const filteredOffences = selectedCategory === 'all'
    ? offences
    : offences.filter(o => o.category === selectedCategory);

  const groupedOffences = filteredOffences.reduce((groups, offence) => {
    const category = offence.category || 'other';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(offence);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="violation-points-info dashboard-card loading">
        <div className="loading-spinner" />
        <p>Loading violation information...</p>
      </div>
    );
  }

  return (
    <div className="violation-points-info dashboard-card">
      <div 
        className="card-header collapsible"
        onClick={() => setExpanded(!expanded)}
      >
        <h3>📋 Violation Points Guide</h3>
        <span className="expand-icon">
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {expanded && (
        <div className="card-content">
          {/* Threshold Warning */}
          <div className="threshold-warning">
            <div className="warning-box">
              <h4>⚠️ Important: License Suspension</h4>
              <p>
                Accumulating <strong>14 or more demerit points</strong> within any 12-month period 
                will result in automatic license suspension.
              </p>
              <p>
                <strong>20+ points</strong> may result in license revocation.
              </p>
            </div>
          </div>

          {/* Category Filter */}
          <div className="category-filter">
            {categories.map((cat) => (
              <button
                key={cat.value}
                className={`category-btn ${selectedCategory === cat.value ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.value)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Offences Table */}
          <div className="offences-table">
            <table>
              <thead>
                <tr>
                  <th>Offence</th>
                  <th>Points</th>
                  <th>Fine Range (BBD)</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedOffences).map(([category, offenceList]) => (
                  <React.Fragment key={category}>
                    <tr className="category-header">
                      <td colSpan="4">
                        {getCategoryIcon(category)} {category.charAt(0).toUpperCase() + category.slice(1)}
                      </td>
                    </tr>
                    {offenceList.map((offence) => (
                      <tr key={offence.offence_code}>
                        <td className="offence-name">
                          {offence.offence_code.replace(/_/g, ' ')}
                        </td>
                        <td className="points-cell">
                          <span 
                            className="points-badge"
                            style={{ backgroundColor: getPointsColor(offence.points) }}
                          >
                            {offence.points} pts
                          </span>
                        </td>
                        <td className="fine-cell">
                          ${offence.fine_min.toLocaleString()} - ${offence.fine_max.toLocaleString()}
                        </td>
                        <td className="severity-cell">
                          <span 
                            className="severity-label"
                            style={{ color: getPointsColor(offence.points) }}
                          >
                            {getPointsLabel(offence.points)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Key Points */}
          <div className="key-points">
            <h4>📝 Key Points to Remember</h4>
            <ul>
              <li><strong>12-Month Rolling Window:</strong> Points expire after 12 months with no violations</li>
              <li><strong>Automatic Suspension:</strong> 14+ points triggers automatic license suspension</li>
              <li><strong>Extended Suspension:</strong> 20+ points may result in 2-year revocation</li>
              <li><strong>Clean Driving Bonus:</strong> Earn merit points for safe driving (see Merit Points)</li>
              <li><strong>Provisional Drivers:</strong> Stricter rules may apply (lower thresholds)</li>
            </ul>
          </div>

          {/* Fine Payment */}
          <div className="fine-payment-info">
            <h4>💳 Paying Your Fine</h4>
            <p>
              Pay your fine within the specified period to avoid additional penalties.
              Early payment may qualify for discounts through the PayFine platform.
            </p>
            <p>
              <strong>Note:</strong> Some offences require court appearance. Check your ticket 
              for court requirements.
            </p>
          </div>

          {/* Data Source */}
          <div className="data-source">
            <p>
              📊 Points and fines based on Barbados Road Traffic Act (Cap. 295) 
              amendments effective 2026. Actual amounts may vary based on court discretion 
              and specific circumstances.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ViolationPointsInfo;

