if Rails.env == "production"
  Imgproxy.configure do |config|
    # Full URL to where your imgproxy lives.
    config.endpoint = "https://imgproxy.progapanda.org"
    # Hex-encoded signature key and salt
    # config.key = ENV["IMGPROXY_KEY"]
    # config.salt = ENV["IMGPROXY_SALT"]
  end
else
  Imgproxy.configure do |config|
    # Full URL to where your imgproxy lives.
    config.endpoint = "http://localhost:8080"
  end
end
