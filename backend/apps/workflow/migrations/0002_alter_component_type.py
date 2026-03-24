from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('workflow', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='component',
            name='type',
            field=models.CharField(
                choices=[
                    ('text', 'text'),
                    ('number', 'number'),
                    ('date', 'date'),
                    ('time', 'time'),
                    ('radio', 'radio'),
                    ('checkbox', 'checkbox'),
                    ('select', 'select'),
                    ('cascade', 'cascade'),
                    ('user', 'user'),
                    ('file', 'file'),
                    ('rich_text', 'rich_text'),
                    ('externaldata', 'externaldata'),
                    ('row', 'row'),
                    ('col', 'col'),
                ],
                max_length=50,
                verbose_name='type',
            ),
        ),
    ]
