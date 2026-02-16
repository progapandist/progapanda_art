Imgproxy.configure do |config|
  config.endpoint = if Rails.env.production?
    "https://imgproxy.progapanda.org"
  else
    "http://localhost:8080"
  end
end
