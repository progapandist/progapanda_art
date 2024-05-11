class WorksController < ApplicationController
  before_action :authenticate, only: [:show, :index]

  def index
    @work = random_work
  end

  def show
    @work = Work.find_by(slug: params[:slug]) || random_work

    if @work.slug == params[:prev_slug]
      @work = Work.without_slug(@work.slug).sample
    end

    @slug = @work&.slug.presence || ""
    @description = @work&.description.presence || ""
  end

  private

  def authenticate
    user = User.new(id: SecureRandom.hex(8))
  end

  def random_work
    Work.all.sample
  end
end
