source "https://rubygems.org"

ruby "3.4.4"

gem "rails", "~> 8.0"

# Asset pipeline [https://github.com/rails/propshaft]
gem "propshaft"

gem "sqlite3", "~> 2.0"
gem "puma", "~> 7.0"

# JavaScript bundling [https://github.com/rails/jsbundling-rails]
gem "jsbundling-rails"

# Hotwire
gem "turbo-rails"
gem "stimulus-rails"

# CSS bundling [https://github.com/rails/cssbundling-rails]
gem "cssbundling-rails"

gem "tzinfo-data", platforms: %i[windows jruby]

gem "thor"
gem "imgproxy"
gem "pagy", "~> 9.0"

group :development, :test do
  gem "debug", platforms: %i[mri windows]
  gem "erb-formatter"
  gem "standard"
  gem "pry-rails"
  gem "dotenv"
end

group :development do
  gem "web-console"
end

group :test do
  gem "capybara"
  gem "selenium-webdriver"
end
