from django.db import migrations


def forwards_rename_externaldata(apps, schema_editor):
    Component = apps.get_model('workflow', 'Component')
    Component.objects.filter(type='externalData').update(type='externaldata')


def backwards_noop(apps, schema_editor):
    Component = apps.get_model('workflow', 'Component')
    Component.objects.filter(type='externaldata').update(type='externalData')


class Migration(migrations.Migration):

    dependencies = [
        ('workflow', '0002_alter_component_type'),
    ]

    operations = [
        migrations.RunPython(forwards_rename_externaldata, backwards_noop),
    ]
