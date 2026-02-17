#!/usr/bin/env python3
"""
Quick Database Initialization Script
Checks if database is properly initialized and fixes common issues
"""

from app import create_app, db
from app.models import Government, User
from datetime import datetime
import sys


def check_and_init_database():
    """Check database and initialize if needed"""
    
    app = create_app()
    
    with app.app_context():
        print("=" * 60)
        print("🔍 PayFine Database Check & Initialization")
        print("=" * 60)
        
        # Check if governments exist
        gov_count = Government.query.count()
        print(f"\n📊 Current Status:")
        print(f"   Governments in database: {gov_count}")
        
        if gov_count == 0:
            print("\n⚠️  No governments found in database!")
            print("   This is likely causing the login 400 errors.")
            
            response = input("\n❓ Would you like to create a default government? (y/n): ")
            
            if response.lower() == 'y':
                print("\n🔧 Creating default government and admin user...")
                
                # Create default government
                government = Government(
                    government_name='Development Government',
                    country_name='Development',
                    country_iso_code='BB',
                    currency_code='BBD',
                    timezone='America/Barbados',
                    legal_framework_version='Development v1.0',
                    payment_gateway_type='powertranz',
                    subdomain='dev',
                    contact_email='dev@payfine.local',
                    contact_phone='+1-000-000-0000',
                    status='active',
                    activated_at=datetime.utcnow()
                )
                
                # Set default payment config
                government.set_payment_config({
                    'merchant_id': '88806220',
                    'password': '7eHpqRiS9f5Sv7GHwYV88KPMecr4mFFGxLCMxZru7OF',
                    'api_url': 'https://staging.ptranz.com'
                })
                
                db.session.add(government)
                db.session.flush()
                
                # Create default admin user
                admin = User(
                    government_id=government.id,
                    username='admin',
                    email='admin@dev.local',
                    full_name='Development Admin',
                    role='admin',
                    is_admin=True,
                    is_active=True
                )
                admin.set_password('admin123')
                db.session.add(admin)
                
                db.session.commit()
                
                print("\n✅ Successfully created:")
                print(f"   Government: {government.government_name} (ID: {government.id})")
                print(f"   Admin User: admin / admin123")
                print("\n🎉 You can now login at http://localhost:3000")
                print("   Username: admin")
                print("   Password: admin123")
                
            else:
                print("\n💡 Tip: Run 'python seed_production_ready.py' for full setup")
                print("   This will create Barbados government with sample data")
                
        else:
            print(f"\n✅ Database has {gov_count} government(s)")
            
            # List governments
            governments = Government.query.all()
            print("\n📋 Governments:")
            for gov in governments:
                user_count = User.query.filter_by(government_id=gov.id).count()
                print(f"   • {gov.government_name} ({gov.country_iso_code})")
                print(f"     Status: {gov.status}")
                print(f"     Users: {user_count}")
                print(f"     Subdomain: {gov.subdomain or 'None'}")
            
            # Check for users
            total_users = User.query.count()
            print(f"\n👥 Total Users: {total_users}")
            
            if total_users == 0:
                print("\n⚠️  No users found!")
                response = input("   Create a default admin user? (y/n): ")
                
                if response.lower() == 'y':
                    first_gov = governments[0]
                    admin = User(
                        government_id=first_gov.id,
                        username='admin',
                        email='admin@dev.local',
                        full_name='Development Admin',
                        role='admin',
                        is_admin=True,
                        is_active=True
                    )
                    admin.set_password('admin123')
                    db.session.add(admin)
                    db.session.commit()
                    
                    print(f"\n✅ Created admin user for {first_gov.government_name}")
                    print("   Username: admin")
                    print("   Password: admin123")
            else:
                # List some users
                print("\n👤 Sample Users:")
                users = User.query.limit(5).all()
                for user in users:
                    gov = Government.query.get(user.government_id)
                    print(f"   • {user.username} ({user.role}) - {gov.government_name if gov else 'Unknown'}")
        
        print("\n" + "=" * 60)
        print("✅ Database check complete!")
        print("=" * 60)
        
        # Provide next steps
        print("\n📝 Next Steps:")
        print("   1. Start backend: cd backend && python run.py")
        print("   2. Start frontend: cd frontend && npm start")
        print("   3. Login at: http://localhost:3000")
        
        if gov_count == 0 or total_users == 0:
            print("\n💡 For full setup with sample data:")
            print("   Run: python seed_production_ready.py")


if __name__ == '__main__':
    try:
        check_and_init_database()
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        print("\n💡 Make sure you're in the backend directory")
        print("   and the database file exists (payfine.db)")
        sys.exit(1)
