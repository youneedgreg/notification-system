{{- define "notification-system.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride }}
{{- else }}
{{- .Release.Name }}
{{- end }}
{{- end }}

{{- define "notification-system.labels" -}}
app.kubernetes.io/part-of: notification-system
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "notification-system.rabbitmqUrl" -}}
amqp://{{ .Values.rabbitmq.auth.username }}:{{ .Values.rabbitmq.auth.password }}@{{ .Release.Name }}-rabbitmq:5672
{{- end }}

{{- define "notification-system.redisHost" -}}
{{ .Release.Name }}-redis-master
{{- end }}

{{- define "notification-system.dbHost" -}}
{{ .Release.Name }}-postgresql
{{- end }}
