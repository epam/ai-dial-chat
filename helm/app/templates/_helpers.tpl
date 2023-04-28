{{/* Generate a full name for the resources */}}
{{- define "app.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name }}
{{- end -}}
