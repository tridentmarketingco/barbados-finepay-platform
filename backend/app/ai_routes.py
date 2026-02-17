"""
AI Routes for PayFine Platform
Provides API endpoints for AI-powered insights and analytics

All endpoints require admin authentication and are multi-tenant aware.

FIXES APPLIED:
- Added AI feature flag checks
- Improved error handling with user-friendly messages
- Added input validation
- Better logging and debugging support
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from datetime import datetime

from . import db
from .models import User, Ticket
from .middleware import get_current_government
from .ai_analytics import AIAnalytics
from .permissions import Permission, permission_required

ai_bp = Blueprint('ai', __name__, url_prefix='/api/ai')


# ============================================================================
# AI INSIGHTS ENDPOINTS
# ============================================================================

@ai_bp.route('/insights/dashboard', methods=['GET'])
@permission_required(Permission.VIEW_AI_INSIGHTS)
def get_ai_dashboard(current_user):
    """
    Get comprehensive AI dashboard data
    
    Query Parameters:
    - days: Analysis period (default: 30)
    
    Returns:
    - Executive summary
    - Predictions
    - Hotspots
    - Anomalies
    - Recommendations
    
    FIXES:
    - Check if AI features are enabled
    - Better error handling with user-friendly messages
    - Validation of input parameters
    """
    try:
        government = get_current_government()
        
        # Check if AI features are enabled
        if not government.ai_features_enabled:
            return jsonify({
                'error': 'AI features are not enabled for your government',
                'message': 'Please enable AI features in the AI Configuration settings to access AI insights.',
                'ai_features_enabled': False
            }), 403
        
        # Validate days parameter
        days = request.args.get('days', 30, type=int)
        if days < 1 or days > 365:
            return jsonify({
                'error': 'Invalid days parameter',
                'message': 'Days must be between 1 and 365'
            }), 400
        
        # Initialize AI analytics
        ai = AIAnalytics(government.id)
        
        # Get AI analytics data
        anomalies_raw = ai.detect_anomalies(days)
        recommendations_raw = ai.generate_recommendations()
        
        # Group anomalies by severity for frontend compatibility
        by_severity = {
            'critical': [a for a in anomalies_raw if a.get('severity') == 'critical'],
            'high': [a for a in anomalies_raw if a.get('severity') == 'high'],
            'medium': [a for a in anomalies_raw if a.get('severity') == 'medium'],
            'low': [a for a in anomalies_raw if a.get('severity') == 'low']
        }
        
        # Group recommendations by category for frontend compatibility
        by_category = {}
        for rec in recommendations_raw:
            category = rec.get('category', 'general')
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(rec)
        
        # Generate comprehensive dashboard
        dashboard = {
            'executive_summary': ai.generate_executive_summary(days),
            'predictions': {
                'tickets': ai.forecast_ticket_volume(30, days),
                'revenue': ai.forecast_revenue(30, days)
            },
            'hotspots': ai.detect_hotspots(days),
            'anomalies': {
                'anomalies': anomalies_raw,
                'by_severity': by_severity
            },
            'recommendations': {
                'recommendations': recommendations_raw,
                'by_category': by_category
            },
            'period_days': days,
            'generated_at': datetime.utcnow().isoformat(),
            'ai_features_enabled': True,
            'openai_enhanced': government.has_openai_enabled()
        }
        
        return jsonify(dashboard), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Failed to generate AI dashboard',
            'message': 'An error occurred while generating AI insights. Please try again or contact support if the issue persists.',
            'details': str(e)
        }), 500


@ai_bp.route('/predictions/tickets', methods=['GET'])
@permission_required(Permission.VIEW_AI_INSIGHTS)
def predict_ticket_volume(current_user):
    """
    Forecast ticket volume
    
    Query Parameters:
    - days_ahead: Days to forecast (default: 30)
    - lookback_days: Historical days to analyze (default: 90)
    
    Returns:
    - Daily ticket volume predictions
    - Confidence intervals
    - Trend analysis
    """
    try:
        government = get_current_government()
        days_ahead = request.args.get('days_ahead', 30, type=int)
        lookback_days = request.args.get('lookback_days', 90, type=int)
        
        ai = AIAnalytics(government.id)
        forecast = ai.forecast_ticket_volume(days_ahead, lookback_days)
        
        return jsonify(forecast), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to forecast tickets: {str(e)}'}), 500


@ai_bp.route('/predictions/revenue', methods=['GET'])
@permission_required(Permission.VIEW_AI_INSIGHTS)
def predict_revenue(current_user):
    """
    Forecast revenue
    
    Query Parameters:
    - days_ahead: Days to forecast (default: 30)
    - lookback_days: Historical days to analyze (default: 90)
    
    Returns:
    - Daily revenue predictions
    - Total predicted revenue
    - Collection rate analysis
    """
    try:
        government = get_current_government()
        days_ahead = request.args.get('days_ahead', 30, type=int)
        lookback_days = request.args.get('lookback_days', 90, type=int)
        
        ai = AIAnalytics(government.id)
        forecast = ai.forecast_revenue(days_ahead, lookback_days)
        
        return jsonify(forecast), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to forecast revenue: {str(e)}'}), 500


@ai_bp.route('/hotspots', methods=['GET'])
@permission_required(Permission.VIEW_AI_INSIGHTS)
def get_hotspots(current_user):
    """
    Get geographic hotspots with high violation rates
    
    Query Parameters:
    - days: Analysis period (default: 30)
    - min_tickets: Minimum tickets to qualify (default: 5)
    
    Returns:
    - List of hotspot locations
    - Ticket counts and patterns
    - Peak hours
    - Recommendations
    """
    try:
        government = get_current_government()
        days = request.args.get('days', 30, type=int)
        min_tickets = request.args.get('min_tickets', 5, type=int)
        
        ai = AIAnalytics(government.id)
        hotspots = ai.detect_hotspots(days, min_tickets)
        
        return jsonify({
            'hotspots': hotspots,
            'total_hotspots': len(hotspots),
            'period_days': days
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to detect hotspots: {str(e)}'}), 500


@ai_bp.route('/anomalies', methods=['GET'])
@permission_required(Permission.VIEW_AI_INSIGHTS)
def get_anomalies(current_user):
    """
    Detect anomalies in ticket and payment patterns
    
    Query Parameters:
    - days: Analysis period (default: 30)
    
    Returns:
    - List of detected anomalies
    - Severity levels
    - Descriptions and recommendations
    """
    try:
        government = get_current_government()
        days = request.args.get('days', 30, type=int)
        
        ai = AIAnalytics(government.id)
        anomalies = ai.detect_anomalies(days)
        
        # Group by severity
        by_severity = {
            'critical': [a for a in anomalies if a.get('severity') == 'critical'],
            'high': [a for a in anomalies if a.get('severity') == 'high'],
            'medium': [a for a in anomalies if a.get('severity') == 'medium'],
            'low': [a for a in anomalies if a.get('severity') == 'low']
        }
        
        return jsonify({
            'anomalies': anomalies,
            'by_severity': by_severity,
            'total_anomalies': len(anomalies),
            'period_days': days
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to detect anomalies: {str(e)}'}), 500


@ai_bp.route('/recommendations', methods=['GET'])
@permission_required(Permission.VIEW_AI_INSIGHTS)
def get_recommendations(current_user):
    """
    Get AI-generated smart recommendations
    
    Returns:
    - Actionable recommendations
    - Priority levels
    - Impact and effort estimates
    """
    try:
        government = get_current_government()
        
        ai = AIAnalytics(government.id)
        recommendations = ai.generate_recommendations()
        
        # Group by category
        by_category = {}
        for rec in recommendations:
            category = rec.get('category', 'general')
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(rec)
        
        return jsonify({
            'recommendations': recommendations,
            'by_category': by_category,
            'total_recommendations': len(recommendations)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to generate recommendations: {str(e)}'}), 500


@ai_bp.route('/risk-assessment/<int:ticket_id>', methods=['GET'])
@permission_required(Permission.VIEW_AI_INSIGHTS)
def assess_payment_risk(ticket_id, current_user):
    """
    Calculate payment risk score for a specific ticket
    
    Returns:
    - Risk score (0-100)
    - Risk level (low/medium/high/critical)
    - Contributing factors
    - Recommendations
    """
    try:
        government = get_current_government()
        
        # Verify ticket belongs to this government
        ticket = Ticket.query.get(ticket_id)
        if not ticket or ticket.government_id != government.id:
            return jsonify({'error': 'Ticket not found'}), 404
        
        ai = AIAnalytics(government.id)
        risk_assessment = ai.calculate_payment_risk(ticket_id)
        
        return jsonify(risk_assessment), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to assess risk: {str(e)}'}), 500


@ai_bp.route('/executive-summary', methods=['GET'])
@permission_required(Permission.VIEW_AI_INSIGHTS)
def get_executive_summary(current_user):
    """
    Get natural language executive summary
    
    Query Parameters:
    - days: Analysis period (default: 30)
    
    Returns:
    - Executive summary with key insights
    - Natural language descriptions
    - Trend analysis
    """
    try:
        government = get_current_government()
        days = request.args.get('days', 30, type=int)
        
        ai = AIAnalytics(government.id)
        summary = ai.generate_executive_summary(days)
        
        return jsonify(summary), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to generate summary: {str(e)}'}), 500


@ai_bp.route('/patterns/time', methods=['GET'])
@permission_required(Permission.VIEW_AI_INSIGHTS)
def get_time_patterns(current_user):
    """
    Analyze time-based patterns in ticket issuance
    
    Query Parameters:
    - days: Analysis period (default: 30)
    
    Returns:
    - Peak hours
    - Day of week patterns
    - Seasonal trends
    """
    try:
        government = get_current_government()
        days = request.args.get('days', 30, type=int)
        
        from datetime import datetime, timedelta
        from collections import defaultdict
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get all tickets in period
        tickets = Ticket.query.filter(
            Ticket.government_id == government.id,
            Ticket.issue_date >= start_date
        ).all()
        
        # Analyze patterns
        hour_counts = defaultdict(int)
        dow_counts = defaultdict(int)
        
        for ticket in tickets:
            hour_counts[ticket.issue_date.hour] += 1
            dow_counts[ticket.issue_date.weekday()] += 1
        
        # Get top hours
        peak_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Day of week names
        dow_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        dow_data = [{'day': dow_names[dow], 'count': count} for dow, count in sorted(dow_counts.items())]
        
        return jsonify({
            'peak_hours': [{'hour': f'{h:02d}:00', 'count': c} for h, c in peak_hours],
            'day_of_week': dow_data,
            'total_tickets': len(tickets),
            'period_days': days
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to analyze time patterns: {str(e)}'}), 500


@ai_bp.route('/officer-insights', methods=['GET'])
@permission_required(Permission.VIEW_AI_INSIGHTS)
def get_officer_insights(current_user):
    """
    Analyze officer performance and productivity
    
    Query Parameters:
    - days: Analysis period (default: 30)
    
    Returns:
    - Officer statistics
    - Performance metrics
    - Outlier detection
    """
    try:
        government = get_current_government()
        days = request.args.get('days', 30, type=int)
        
        from datetime import datetime, timedelta
        from sqlalchemy import func
        import statistics
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get officer statistics
        officer_stats = db.session.query(
            Ticket.officer_badge,
            func.count(Ticket.id).label('ticket_count'),
            func.avg(Ticket.fine_amount).label('avg_fine'),
            func.count(func.distinct(Ticket.location)).label('locations_covered')
        ).filter(
            Ticket.government_id == government.id,
            Ticket.officer_badge.isnot(None),
            Ticket.officer_badge != '',
            Ticket.issue_date >= start_date
        ).group_by(Ticket.officer_badge).all()
        
        if not officer_stats:
            return jsonify({
                'officers': [],
                'message': 'No officer data available'
            }), 200
        
        # Calculate statistics
        counts = [os[1] for os in officer_stats]
        avg_tickets = statistics.mean(counts)
        std_dev = statistics.stdev(counts) if len(counts) > 1 else 0
        
        # Build officer data
        officers = []
        for badge, count, avg_fine, locations in officer_stats:
            # Determine performance level
            if count > avg_tickets + std_dev:
                performance = 'above_average'
            elif count < avg_tickets - std_dev:
                performance = 'below_average'
            else:
                performance = 'average'
            
            officers.append({
                'officer_badge': badge,
                'ticket_count': count,
                'avg_fine': float(avg_fine or 0),
                'locations_covered': locations,
                'performance': performance,
                'deviation_from_avg': round(count - avg_tickets, 1)
            })
        
        # Sort by ticket count
        officers.sort(key=lambda x: x['ticket_count'], reverse=True)
        
        return jsonify({
            'officers': officers,
            'statistics': {
                'total_officers': len(officers),
                'avg_tickets_per_officer': round(avg_tickets, 1),
                'std_deviation': round(std_dev, 1),
                'top_performer': officers[0]['officer_badge'] if officers else None,
                'total_tickets': sum(counts)
            },
            'period_days': days
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to analyze officer insights: {str(e)}'}), 500


@ai_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for AI service"""
    return jsonify({
        'status': 'healthy',
        'service': 'AI Analytics',
        'version': '1.0.0'
    }), 200
