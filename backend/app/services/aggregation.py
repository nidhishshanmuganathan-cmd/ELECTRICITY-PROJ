from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.usage import DailyUsage, MonthlyUsage
from app.models.reading import MeterReading
from datetime import datetime, timedelta

class AggregationService:
    @staticmethod
    def aggregate_device_data(db: Session, device_id):
        """
        Aggregates raw meter readings into daily and monthly summaries.
        """
        # 1. Aggregate Daily Usage
        # Using raw SQL for performance since we are summing potentially thousands of rows
        daily_query = text("""
            SELECT 
                DATE(recorded_at) as date, 
                SUM(energy) as total_energy, 
                MAX(power) as peak_power 
            FROM meter_readings 
            WHERE device_id = :device_id 
            GROUP BY DATE(recorded_at)
        """)
        
        daily_results = db.execute(daily_query, {"device_id": device_id}).fetchall()
        
        for row in daily_results:
            date_str = row[0].strftime('%Y-%m-%d')
            # Upsert DailyUsage
            existing = db.query(DailyUsage).filter(
                DailyUsage.device_id == device_id, 
                DailyUsage.date == date_str
            ).first()
            
            if existing:
                existing.total_energy = row[1]
                existing.peak_power = row[2]
            else:
                db.add(DailyUsage(
                    device_id=device_id,
                    date=date_str,
                    total_energy=row[1],
                    peak_power=row[2]
                ))

        # 2. Aggregate Monthly Usage
        monthly_query = text("""
            SELECT 
                TO_CHAR(recorded_at, 'YYYY-MM') as month, 
                SUM(energy) as total_energy 
            FROM meter_readings 
            WHERE device_id = :device_id 
            GROUP BY TO_CHAR(recorded_at, 'YYYY-MM')
        """)
        
        monthly_results = db.execute(monthly_query, {"device_id": device_id}).fetchall()
        
        for row in monthly_results:
            month_str = row[0]
            # Upsert MonthlyUsage
            existing = db.query(MonthlyUsage).filter(
                MonthlyUsage.device_id == device_id, 
                MonthlyUsage.month == month_str
            ).first()
            
            if existing:
                existing.total_energy = row[1]
            else:
                db.add(MonthlyUsage(
                    device_id=device_id,
                    month=month_str,
                    total_energy=row[1]
                ))
        
        db.commit()
        return True
