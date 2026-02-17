"""
PayFine Production-Ready Seed Script
Seeds database with initial data for all dashboards to work
"""

from app import create_app, db
from app.models import (
    Government, OperatorUser, User, Service,
    OffenceCategory, Offence, PenaltyRule,
    Ticket, GovernmentBilling
)
from datetime import datetime, timedelta, date
import secrets


def seed_production_data():
    """Seed database with production-ready data"""
    
    app = create_app()
    
    with app.app_context():
        print("🌱 Seeding PayFine database...")
        
        # 1. Create Super Admin Operator
        print("\n1️⃣ Creating Super Admin Operator...")
        operator = OperatorUser.query.filter_by(username='admin').first()
        if not operator:
            operator = OperatorUser(
                username='admin',
                email='admin@payfine.com',
                full_name='PayFine Administrator',
                role='super_admin',
                is_active=True
            )
            operator.set_password('admin123')  # CHANGE IN PRODUCTION
            db.session.add(operator)
            db.session.flush()
            print("✅ Super admin created: admin / admin123")
        else:
            print("⏭️  Super admin already exists")
        
        # 2. Create Barbados Government
        print("\n2️⃣ Creating Barbados Government...")
        barbados = Government.query.filter_by(country_iso_code='BB').first()
        if not barbados:
            barbados = Government(
                government_name='Government of Barbados',
                country_name='Barbados',
                country_iso_code='BB',
                currency_code='BBD',
                timezone='America/Barbados',
                legal_framework_version='Road Traffic Act 2024',
                payment_gateway_type='powertranz',
                subdomain='barbados',
                contact_email='info@payfine.gov.bb',
                contact_phone='+1-246-228-2503',
                status='active',
                activated_at=datetime.utcnow()
            )
            
            # Set payment config
            barbados.set_payment_config({
                'merchant_id': '88806220',
                'password': '7eHpqRiS9f5Sv7GHwYV88KPMecr4mFFGxLCMxZru7OF',
                'api_url': 'https://staging.ptranz.com'
            })
            
            db.session.add(barbados)
            db.session.flush()
            print("✅ Barbados government created")
        else:
            print("⏭️  Barbados government already exists")
        
        # 3. Create Government Admin User
        print("\n3️⃣ Creating Government Admin...")
        gov_admin = User.query.filter_by(
            government_id=barbados.id,
            username='govadmin'
        ).first()
        if not gov_admin:
            gov_admin = User(
                government_id=barbados.id,
                username='govadmin',
                email='admin@gov.bb',
                full_name='Government Administrator',
                role='admin',
                is_admin=True,
                is_active=True
            )
            gov_admin.set_password('admin123')  # CHANGE IN PRODUCTION
            db.session.add(gov_admin)
            print("✅ Government admin created: govadmin / admin123")
        else:
            print("⏭️  Government admin already exists")
        
        # 4. Create Warden User
        print("\n4️⃣ Creating Warden...")
        warden = User.query.filter_by(
            government_id=barbados.id,
            username='warden1'
        ).first()
        if not warden:
            warden = User(
                government_id=barbados.id,
                username='warden1',
                email='warden@gov.bb',
                full_name='Traffic Warden',
                role='staff',
                is_admin=False,
                is_active=True
            )
            warden.set_password('warden123')  # CHANGE IN PRODUCTION
            db.session.add(warden)
            print("✅ Warden created: warden1 / warden123")
        else:
            print("⏭️  Warden already exists")
        
        # 5. Create Service
        print("\n5️⃣ Creating Traffic Fines Service...")
        service = Service.query.filter_by(
            government_id=barbados.id,
            name='Traffic Fines'
        ).first()
        if not service:
            service = Service(
                government_id=barbados.id,
                name='Traffic Fines',
                description='Traffic violation fines and penalties',
                is_active=True
            )
            db.session.add(service)
            db.session.flush()
            print("✅ Traffic Fines service created")
        else:
            print("⏭️  Traffic Fines service already exists")
        
        # 6. Create Offence Categories
        print("\n6️⃣ Creating Offence Categories...")
        categories_data = [
            ('SPEED', 'Speeding Offences', 'Exceeding posted speed limits'),
            ('PARK', 'Parking Violations', 'Illegal or improper parking'),
            ('DUI', 'Driving Under Influence', 'Alcohol or drug impairment'),
            ('RECKLESS', 'Reckless Driving', 'Dangerous or reckless operation'),
            ('LICENSE', 'License Violations', 'Invalid or missing license/registration')
        ]
        
        categories = {}
        for code, name, desc in categories_data:
            cat = OffenceCategory.query.filter_by(
                government_id=barbados.id,
                code=code
            ).first()
            if not cat:
                cat = OffenceCategory(
                    government_id=barbados.id,
                    code=code,
                    name=name,
                    description=desc,
                    active=True
                )
                db.session.add(cat)
                db.session.flush()
                print(f"  ✅ Created category: {code}")
            categories[code] = cat
        
        # 7. Create Offences with Penalty Rules
        print("\n7️⃣ Creating Offences and Penalty Rules...")
        
        # Speeding offences
        speed_offences = [
            ('SPEED-10', 'Speeding 1-10 km/h over limit', 'speed', 'km/h', 1, 10, 50, 0, False),
            ('SPEED-20', 'Speeding 11-20 km/h over limit', 'speed', 'km/h', 11, 20, 100, 2, False),
            ('SPEED-30', 'Speeding 21-30 km/h over limit', 'speed', 'km/h', 21, 30, 200, 3, False),
            ('SPEED-40', 'Speeding 31+ km/h over limit', 'speed', 'km/h', 31, 999, 500, 6, True),
        ]
        
        for code, name, mtype, unit, min_val, max_val, fine, points, court in speed_offences:
            offence = Offence.query.filter_by(
                government_id=barbados.id,
                code=code
            ).first()
            if not offence:
                offence = Offence(
                    government_id=barbados.id,
                    code=code,
                    name=name,
                    category_id=categories['SPEED'].id,
                    measurable_type=mtype,
                    unit=unit,
                    active=True
                )
                db.session.add(offence)
                db.session.flush()
                
                # Create penalty rule
                rule = PenaltyRule(
                    government_id=barbados.id,
                    offence_id=offence.id,
                    min_value=min_val,
                    max_value=max_val,
                    base_fine=fine,
                    points=points,
                    court_required=court,
                    repeat_multiplier=1.5,
                    effective_from=date.today(),
                    active=True
                )
                db.session.add(rule)
                print(f"  ✅ Created offence: {code} (${fine}, {points} pts)")
        
        # Fixed offences
        fixed_offences = [
            ('PARK-METER', 'Parking Meter Violation', 'PARK', 'none', None, 25, 0, False),
            ('PARK-HANDICAP', 'Parking in Handicap Zone', 'PARK', 'none', None, 250, 3, False),
            ('NO-LICENSE', 'Driving Without License', 'LICENSE', 'none', None, 500, 6, True),
            ('EXPIRED-REG', 'Expired Registration', 'LICENSE', 'none', None, 100, 2, False),
        ]
        
        for code, name, cat_code, mtype, unit, fine, points, court in fixed_offences:
            offence = Offence.query.filter_by(
                government_id=barbados.id,
                code=code
            ).first()
            if not offence:
                offence = Offence(
                    government_id=barbados.id,
                    code=code,
                    name=name,
                    category_id=categories[cat_code].id,
                    measurable_type=mtype,
                    unit=unit,
                    active=True
                )
                db.session.add(offence)
                db.session.flush()
                
                # Create penalty rule
                rule = PenaltyRule(
                    government_id=barbados.id,
                    offence_id=offence.id,
                    base_fine=fine,
                    points=points,
                    court_required=court,
                    repeat_multiplier=1.5,
                    effective_from=date.today(),
                    active=True
                )
                db.session.add(rule)
                print(f"  ✅ Created offence: {code} (${fine}, {points} pts)")
        
        # 8. Create Sample Tickets
        print("\n8️⃣ Creating Sample Tickets...")
        
        # Get first offence for sample tickets
        speed_offence = Offence.query.filter_by(
            government_id=barbados.id,
            code='SPEED-20'
        ).first()
        
        park_offence = Offence.query.filter_by(
            government_id=barbados.id,
            code='PARK-METER'
        ).first()
        
        sample_tickets = [
            {
                'serial_number': 'A459778',
                'offence': speed_offence,
                'measured_value': 15,
                'vehicle_plate': 'ABC-123',
                'driver_name': 'John Doe',
                'driver_license': 'DL123456',
                'location': 'Highway 1, Mile 5',
                'status': 'unpaid',
                'days_offset': -5
            },
            {
                'serial_number': 'B123456',
                'offence': park_offence,
                'measured_value': None,
                'vehicle_plate': 'XYZ-789',
                'driver_name': 'Jane Smith',
                'driver_license': 'DL789012',
                'location': 'Bridgetown, Broad Street',
                'status': 'paid',
                'days_offset': -10
            },
            {
                'serial_number': 'C789012',
                'offence': speed_offence,
                'measured_value': 18,
                'vehicle_plate': 'DEF-456',
                'driver_name': 'Bob Johnson',
                'driver_license': 'DL345678',
                'location': 'ABC Highway, Mile 3',
                'status': 'overdue',
                'days_offset': -45
            }
        ]
        
        for ticket_data in sample_tickets:
            existing = Ticket.query.filter_by(
                government_id=barbados.id,
                serial_number=ticket_data['serial_number']
            ).first()
            
            if not existing:
                issue_date = datetime.utcnow() + timedelta(days=ticket_data['days_offset'])
                due_date = issue_date + timedelta(days=30)
                
                ticket = Ticket(
                    government_id=barbados.id,
                    serial_number=ticket_data['serial_number'],
                    service_id=service.id,
                    offence_id=ticket_data['offence'].id if ticket_data['offence'] else None,
                    measured_value=ticket_data['measured_value'],
                    offense_description=ticket_data['offence'].name if ticket_data['offence'] else 'Traffic Violation',
                    vehicle_plate=ticket_data['vehicle_plate'],
                    driver_name=ticket_data['driver_name'],
                    driver_license=ticket_data['driver_license'],
                    location=ticket_data['location'],
                    officer_badge='OFF-001',
                    issue_date=issue_date,
                    due_date=due_date,
                    status=ticket_data['status'],
                    created_by_id=warden.id
                )
                
                # Calculate fine if offence provided
                if ticket_data['offence']:
                    calculated_fine = ticket.calculate_fine()
                    ticket.fine_amount = calculated_fine or 100
                else:
                    ticket.fine_amount = 100
                
                # Mark as paid if status is paid
                if ticket_data['status'] == 'paid':
                    ticket.paid_date = issue_date + timedelta(days=5)
                    ticket.payment_amount = ticket.fine_amount
                    ticket.payment_method = 'online'
                    ticket.payment_reference = f'TXN-{secrets.token_hex(4).upper()}'
                
                db.session.add(ticket)
                print(f"  ✅ Created ticket: {ticket_data['serial_number']} ({ticket_data['status']})")
        
        # 9. Create Billing Record
        print("\n9️⃣ Creating Sample Billing Record...")
        current_month = datetime.utcnow().strftime('%Y-%m')
        billing = GovernmentBilling.query.filter_by(
            government_id=barbados.id,
            billing_month=current_month
        ).first()
        
        if not billing:
            # Calculate from paid tickets
            paid_tickets = Ticket.query.filter_by(
                government_id=barbados.id,
                status='paid'
            ).all()
            
            total_revenue = sum(float(t.payment_amount or 0) for t in paid_tickets)
            
            billing = GovernmentBilling(
                government_id=barbados.id,
                billing_period_start=date.today().replace(day=1),
                billing_period_end=date.today(),
                billing_month=current_month,
                transaction_count=len(paid_tickets),
                successful_transactions=len(paid_tickets),
                total_revenue=total_revenue,
                platform_fee_percentage=2.5,
                invoice_number=f'INV-BB-{current_month}-{secrets.token_hex(4).upper()}',
                status='pending'
            )
            billing.calculate_fees()
            db.session.add(billing)
            print(f"✅ Billing record created for {current_month}")
        
        # Commit all changes
        db.session.commit()
        
        print("\n" + "="*60)
        print("✅ DATABASE SEEDED SUCCESSFULLY!")
        print("="*60)
        print("\n📋 LOGIN CREDENTIALS:")
        print("\n🔐 Super Admin (Operator Panel):")
        print("   URL: http://localhost:3000/operator/login")
        print("   Username: admin")
        print("   Password: admin123")
        
        print("\n🏛️ Government Admin:")
        print("   URL: http://localhost:3000/admin")
        print("   Username: govadmin")
        print("   Password: admin123")
        
        print("\n👮 Warden:")
        print("   URL: http://localhost:3000/warden")
        print("   Username: warden1")
        print("   Password: warden123")
        
        print("\n🎫 Sample Tickets:")
        print("   A459778 (Unpaid)")
        print("   B123456 (Paid)")
        print("   C789012 (Overdue)")
        
        print("\n⚠️  IMPORTANT: Change all passwords in production!")
        print("="*60 + "\n")


if __name__ == '__main__':
    seed_production_data()
