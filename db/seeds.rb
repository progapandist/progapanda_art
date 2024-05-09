Work.destroy_all

slugs = [
  "sparrow",
  "date_line",
  "spam",
  "speed",
  "crow",
  "symbols"
]

slugs.each do |slug|
  m = Work.find_or_create_by!(slug:)
  m.update!(description: "A #{slug.humanize} model.")
end
