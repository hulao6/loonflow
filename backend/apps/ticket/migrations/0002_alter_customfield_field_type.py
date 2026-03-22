from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ticket', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customfield',
            name='field_type',
            field=models.CharField(
                choices=[
                    ('text', 'text'),
                    ('number', 'number'),
                    ('date', 'date'),
                    ('datetime', 'datetime'),
                    ('time', 'time'),
                    ('select', 'select'),
                    ('cascade', 'cascade'),
                    ('user', 'user'),
                    ('file', 'file'),
                    ('rich_text', 'rich_text'),
                    ('external_data_source', 'external_data_source'),
                ],
                max_length=50,
                verbose_name='field_type',
            ),
        ),
    ]
